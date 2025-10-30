#!/usr/bin/env bash
set -euo pipefail

API_ENDPOINT="https://iqfnlcxwx8.execute-api.us-east-1.amazonaws.com/dev"
REGION="us-east-1"
CLIENT_ID="2v1ovouait43844e0t3gl39veh"

ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="Admin@12345"

# Replace with the actual Cognito sub (userId) of the target user
TARGET_USER_ID="Dfortune014@gmail.com"
NEW_ROLE="Editor"

get_admin_token() {
  aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$CLIENT_ID" \
    --auth-parameters USERNAME="$ADMIN_EMAIL",PASSWORD="$ADMIN_PASSWORD" \
    --region "$REGION" \
    | jq -r '.AuthenticationResult.IdToken'
}

echo "🔐 Logging in as Admin..."
TOKEN=$(get_admin_token)

if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
  echo "❌ Failed to log in as Admin"
  exit 1
fi

echo "✅ Got Admin token"
echo "➡️  Updating role for userId: $TARGET_USER_ID -> $NEW_ROLE"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PATCH "$API_ENDPOINT/api/users/$TARGET_USER_ID/role" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"$NEW_ROLE\"}")

BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "-----------------------------------------"
echo "📡 Response:"
echo "$BODY" | jq '.'
echo "-----------------------------------------"
echo "HTTP Status: $STATUS"

if [[ "$STATUS" == "200" ]]; then
  echo "✅ SUCCESS: Role updated to $NEW_ROLE"
else
  echo "❌ ERROR updating role"
  echo "$BODY"
fi
