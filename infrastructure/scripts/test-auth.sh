#!/bin/bash
set -e

# Load Terraform outputs
USER_POOL_ID=$(terraform -chdir=../terraform output -raw user_pool_id)
CLIENT_ID=$(terraform -chdir=../terraform output -raw user_pool_client_id)

echo "🔐 Using Cognito User Pool: $USER_POOL_ID"
echo "🔐 Using Cognito App Client: $CLIENT_ID"

#############################################
# 1. Create test users
#############################################
echo "👤 Creating test users..."

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@test.com \
  --user-attributes Name=email,Value=admin@test.com \
  --temporary-password "Admin@1234" || true

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username editor@test.com \
  --user-attributes Name=email,Value=editor@test.com \
  --temporary-password "Editor@1234" || true

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username viewer@test.com \
  --user-attributes Name=email,Value=viewer@test.com \
  --temporary-password "Viewer@1234" || true

#############################################
# 2. Assign users to groups
#############################################
echo "👥 Assigning users to groups..."

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@test.com \
  --group-name Admins || true

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username editor@test.com \
  --group-name Editors || true

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username viewer@test.com \
  --group-name Viewers || true

#############################################
# 3. Test login for each user
#############################################
echo "🔑 Testing login flows (using ALLOW_USER_PASSWORD_AUTH)..."

function test_login() {
  local USERNAME=$1
  local PASSWORD=$2
  echo "➡️ Logging in as $USERNAME"

  aws cognito-idp initiate-auth \
    --client-id $CLIENT_ID \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters USERNAME=$USERNAME,PASSWORD=$PASSWORD || true
}

test_login "admin@test.com" "Admin@1234"
test_login "editor@test.com" "Editor@1234"
test_login "viewer@test.com" "Viewer@1234"

#############################################
# 4. Instructions for password reset
#############################################
cat <<EOM

ℹ️ Note: If login output shows "NEW_PASSWORD_REQUIRED",
you need to complete the challenge by setting a new password:

aws cognito-idp respond-to-auth-challenge \\
  --client-id $CLIENT_ID \\
  --challenge-name NEW_PASSWORD_REQUIRED \\
  --challenge-responses USERNAME=<email>,NEW_PASSWORD=<newpass> \\
  --session <SessionFromLoginResponse>

EOM

echo "✅ Test script complete."
