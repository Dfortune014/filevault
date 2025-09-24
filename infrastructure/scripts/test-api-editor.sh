#!/usr/bin/env bash
set -euo pipefail

EMAIL=${1:-editor@test.com}
PASS=${2:-Editor@12345}
API_ENDPOINT="https://iqfnlcxwx8.execute-api.us-east-1.amazonaws.com/dev"
REGION="us-east-1"
CLIENT_ID="2v1ovouait43844e0t3gl39veh"
USER_POOL_ID="us-east-1_Ec9xeU43z"

echo "🔐 Logging in as $EMAIL..."
AUTH_RESULT=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=$EMAIL,PASSWORD=$PASS \
  --region $REGION)

ID_TOKEN=$(echo $AUTH_RESULT | jq -r '.AuthenticationResult.IdToken')
echo "✅ Got ID token"

echo "➡️  POST /api/files/upload-url (Editor can upload)"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: $ID_TOKEN" \
  -X POST $API_ENDPOINT/api/files/upload-url -d '{}'

echo "➡️  GET /api/files (Editor can list)"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: $ID_TOKEN" \
  $API_ENDPOINT/api/files

echo "➡️  GET /api/files/test.txt/download (Editor can download)"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: $ID_TOKEN" \
  $API_ENDPOINT/api/files/test.txt/download

echo "➡️  DELETE /api/files/test.txt (Editor should FAIL)"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: $ID_TOKEN" \
  -X DELETE $API_ENDPOINT/api/files/test.txt
