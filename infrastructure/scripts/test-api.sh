#!/bin/bash
set -euo pipefail

# Auto-detect curl
CURL_BIN=$(which curl 2>/dev/null || echo "/usr/bin/curl")
if [ ! -x "$CURL_BIN" ]; then
  echo "❌ curl not found. Please install curl (apt install -y curl)."
  exit 1
fi

# Load Terraform outputs
API_ENDPOINT=$(terraform -chdir=../terraform output -raw api_endpoint)/dev
USER_POOL_ID=$(terraform -chdir=../terraform output -raw user_pool_id)
CLIENT_ID=$(terraform -chdir=../terraform output -raw user_pool_client_id)

if [ $# -lt 2 ]; then
  echo "Usage: $0 <username> <password>"
  exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "🔐 API Endpoint: $API_ENDPOINT"
echo "🔐 Cognito User Pool: $USER_POOL_ID"
echo "🔐 Cognito Client ID: $CLIENT_ID"
echo "➡️  Logging in as $USERNAME..."

#############################################
# 1. Authenticate user → Get ID Token
#############################################
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --query 'AuthenticationResult.IdToken' \
  --output text)

if [ "$ID_TOKEN" == "null" ] || [ -z "$ID_TOKEN" ]; then
  echo "❌ Failed to authenticate user"
  exit 1
fi
echo "✅ Got ID token"

#############################################
# 2. Test Endpoints
#############################################
function test_endpoint() {
  local METHOD=$1
  local PATH=$2
  local BODY=${3:-}

  echo -n "➡️  $METHOD $PATH ... "
  if [ -z "$BODY" ]; then
    RESP=$($CURL_BIN -s -o /dev/null -w "%{http_code}" -X $METHOD \
      "$API_ENDPOINT$PATH" \
      -H "Authorization: $ID_TOKEN")
  else
    RESP=$($CURL_BIN -s -o /dev/null -w "%{http_code}" -X $METHOD \
      "$API_ENDPOINT$PATH" \
      -H "Authorization: $ID_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$BODY")
  fi

  if [[ "$RESP" =~ ^2 ]]; then
    echo "✅ PASS ($RESP)"
  else
    echo "❌ FAIL ($RESP)"
  fi
}

# Upload URL
test_endpoint "POST" "/api/files/upload-url" '{"filename":"test.txt"}'

# List files
test_endpoint "GET" "/api/files"

# Download (id mapped in path)
test_endpoint "GET" "/api/files/test.txt/download"

# Delete (id mapped in path)
test_endpoint "DELETE" "/api/files/test.txt"
