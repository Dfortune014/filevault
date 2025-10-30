#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
API_ENDPOINT="https://iqfnlcxwx8.execute-api.us-east-1.amazonaws.com/dev"
REGION="us-east-1"
CLIENT_ID="2v1ovouait43844e0t3gl39veh"

declare -A USERS
USERS["Admin"]="admin@test.com:Admin@12345"
USERS["Editor"]="editor@test.com:Editor@12345"
USERS["Viewer"]="Dfortune014@gmail.com:Fortunegad@14"

# --- Helper Functions ---
get_token() {
  local email="$1"
  local password="$2"

  aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$CLIENT_ID" \
    --auth-parameters USERNAME="$email",PASSWORD="$password" \
    --region "$REGION" \
    | jq -r '.AuthenticationResult.IdToken'
}

call_api() {
  local role="$1"
  local token="$2"

  echo
  echo "➡️  Testing GET /api/files as $role"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    "$API_ENDPOINT/api/files")

  BODY=$(echo "$RESPONSE" | head -n1)
  STATUS=$(echo "$RESPONSE" | tail -n1)

  echo "HTTP $STATUS"
  if [[ "$STATUS" == "200" ]]; then
    COUNT=$(echo "$BODY" | jq '.files | length')
    echo "✅ $role can access $COUNT files"
    echo "$BODY" | jq '.files[0:3]'  # show first few files
  else
    echo "❌ Failed with status $STATUS"
    echo "$BODY" | jq '.'
  fi
}

# --- Main Loop ---
for ROLE in "${!USERS[@]}"; do
  echo "🔐 Logging in as $ROLE..."
  CREDS="${USERS[$ROLE]}"
  EMAIL="${CREDS%%:*}"
  PASSWORD="${CREDS#*:}"

  TOKEN=$(get_token "$EMAIL" "$PASSWORD")

  if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
    echo "❌ Failed to log in as $ROLE ($EMAIL)"
    continue
  fi

  echo "✅ Got token for $ROLE (${EMAIL})"
  call_api "$ROLE" "$TOKEN"
done

echo
echo "🧾 Test complete. Verify file counts per role."
