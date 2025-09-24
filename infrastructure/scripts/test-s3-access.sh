#!/bin/bash
set -e

# Load Terraform outputs
USER_POOL_ID=$(terraform -chdir=../terraform output -raw user_pool_id)
CLIENT_ID=$(terraform -chdir=../terraform output -raw user_pool_client_id)
IDENTITY_POOL_ID=$(terraform -chdir=../terraform output -raw identity_pool_id)
KMS_KEY_ID=$(terraform -chdir=../terraform output -raw kms_key_id)
AWS_REGION=$(terraform -chdir=../terraform output -raw region 2>/dev/null || echo "us-east-1")

if [ $# -lt 2 ]; then
  echo "Usage: $0 <username> <password>"
  exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "🔐 Using User Pool: $USER_POOL_ID"
echo "🔐 Using Client ID: $CLIENT_ID"
echo "🔐 Using Identity Pool: $IDENTITY_POOL_ID"
echo "🔐 Using KMS Key: $KMS_KEY_ID"
echo "🌎 AWS Region: $AWS_REGION"
echo "➡️  Logging in as $USERNAME"

#############################################
# 1. Authenticate user to get ID token
#############################################
AUTH_RESULT=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=$USERNAME,PASSWORD=$PASSWORD)

ID_TOKEN=$(echo $AUTH_RESULT | jq -r .AuthenticationResult.IdToken)

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" == "null" ]; then
  echo "❌ Failed to authenticate user: $USERNAME"
  exit 1
fi

echo "✅ Got ID token"

#############################################
# 2. Get Identity ID using the token
#############################################
IDENTITY_ID=$(aws cognito-identity get-id \
  --identity-pool-id $IDENTITY_POOL_ID \
  --logins "{\"cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}\":\"$ID_TOKEN\"}" \
  --query 'IdentityId' --output text)

if [ -z "$IDENTITY_ID" ]; then
  echo "❌ Failed to resolve Identity ID"
  exit 1
fi

echo "✅ Identity ID: $IDENTITY_ID"

#############################################
# 3. Exchange for temporary AWS credentials
#############################################
CREDS=$(aws cognito-identity get-credentials-for-identity \
  --identity-id $IDENTITY_ID \
  --logins "{\"cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}\":\"$ID_TOKEN\"}")

AWS_ACCESS_KEY_ID=$(echo $CREDS | jq -r .Credentials.AccessKeyId)
AWS_SECRET_ACCESS_KEY=$(echo $CREDS | jq -r .Credentials.SecretKey)
AWS_SESSION_TOKEN=$(echo $CREDS | jq -r .Credentials.SessionToken)

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ "$AWS_ACCESS_KEY_ID" == "null" ]; then
  echo "❌ Failed to get temporary AWS credentials"
  exit 1
fi

echo "✅ Got temporary AWS credentials"

#############################################
# 4. Test S3 permissions
#############################################
BUCKET="filevault-files"
TEST_FILE="test-${USERNAME}.txt"
echo "Hello from $USERNAME" > $TEST_FILE

function run_action() {
  local CMD=$1
  local EXPECTED=$2
  local DESC=$3

  if AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
     AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
     AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN \
     aws $CMD > /dev/null 2>&1; then
    if [ "$EXPECTED" == "ALLOW" ]; then
      echo "✅ PASS: $DESC"
    else
      echo "❌ FAIL: $DESC (was ALLOWED but should be DENIED)"
    fi
  else
    if [ "$EXPECTED" == "DENY" ]; then
      echo "✅ PASS: $DESC correctly denied"
    else
      echo "❌ FAIL: $DESC (was DENIED but should be ALLOWED)"
    fi
  fi
}

echo "🔎 Testing S3 access for $USERNAME..."
run_action "s3 ls s3://$BUCKET/" "ALLOW" "List bucket"
run_action "s3 cp $TEST_FILE s3://$BUCKET/$TEST_FILE --sse aws:kms --sse-kms-key-id $KMS_KEY_ID" "ALLOW" "Upload object"
run_action "s3 rm s3://$BUCKET/$TEST_FILE" "ALLOW" "Delete object"
