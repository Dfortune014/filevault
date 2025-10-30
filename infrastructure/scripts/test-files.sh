#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------
# Test: GET /api/files + verify user delegation
# Secure File Vault – Role-based listing + delegation validation
# -----------------------------------------

API_ENDPOINT="https://iqfnlcxwx8.execute-api.us-east-1.amazonaws.com/dev"
REGION="us-east-1"
CLIENT_ID="2v1ovouait43844e0t3gl39veh"
USERS_TABLE="FileVaultUsers"

# --- User credentials (use real test users) ---
declare -A USERS
USERS["Admin"]="fortune.linus@stillman.edu:Admin@12345"
USERS["Viewer"]="linusfortune54@gmail.com:Uwama@2022"
USERS["Editor"]="Dfortune014@gmail.com:Fortunegad@14"

# --- Helper: Get token from Cognito ---
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

# --- Helper: Call API ---
call_api() {
  local role="$1"
  local token="$2"

  echo
  echo "➡️  Testing GET /api/files as $role"
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    "$API_ENDPOINT/api/files")

  BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
  STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

  echo "HTTP $STATUS"
  if [[ "$STATUS" == "200" ]]; then
    COUNT=$(echo "$BODY" | jq '.files | length')
    echo "✅ $role can access $COUNT files"
    echo "$BODY" | jq '.files[0:3]'  # show first few files
  else
    echo "❌ $role failed with status $STATUS"
    echo "$BODY" | jq '.'
  fi
}

# --- New Helper: Check delegation relationships ---
check_delegations() {
  echo
  echo "🔍 Checking current Viewer → Editor assignments in $USERS_TABLE"
  aws dynamodb scan \
    --table-name "$USERS_TABLE" \
    --projection-expression "email, delegatedEditor, #r" \
    --expression-attribute-names '{"#r":"role"}' \
    --region "$REGION" \
    | jq -r '
      .Items[] | {
        email: .email.S,
        role: .r.S,
        delegatedEditor: (if .delegatedEditor.S then .delegatedEditor.S else "-" end)
      }'
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

  # Only the Admin performs the delegation check
  if [[ "$ROLE" == "Admin" ]]; then
    check_delegations
  fi
done

echo
echo "🧾 Test complete. Verify file counts and delegation links per role."
