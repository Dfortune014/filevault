#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------
# Test: GET /api/users/delegated
# Secure File Vault – Editor-only delegated viewers check
# -----------------------------------------

API_ENDPOINT="https://iqfnlcxwx8.execute-api.us-east-1.amazonaws.com/dev"
REGION="us-east-1"
CLIENT_ID="2v1ovouait43844e0t3gl39veh"

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

# --- Helper: Call GET /api/users/delegated ---
call_get_delegated_users() {
  local role="$1"
  local token="$2"

  echo
  echo "➡️  Testing GET /api/users/delegated as $role..."
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    "$API_ENDPOINT/api/users/delegated")

  BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
  STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

  echo "HTTP $STATUS"

  if [[ "$STATUS" == "200" ]]; then
    COUNT=$(echo "$BODY" | jq '.delegatedViewers | length')
    echo "✅ $role can access $COUNT delegated viewers"
    echo "$BODY" | jq '.delegatedViewers'
  else
    echo "❌ $role failed ($STATUS)"
    echo "$BODY" | jq '.'
  fi
}

# --- Main Execution ---
for ROLE in "${!USERS[@]}"; do
  echo
  echo "🔐 Logging in as $ROLE..."
  CREDS="${USERS[$ROLE]}"
  EMAIL="${CREDS%%:*}"
  PASSWORD="${CREDS#*:}"

  TOKEN=$(get_token "$EMAIL" "$PASSWORD")

  if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
    echo "❌ Failed to log in as $ROLE ($EMAIL)"
    continue
  fi

  echo "✅ Got token for $ROLE ($EMAIL)"

  call_get_delegated_users "$ROLE" "$TOKEN"
done

echo
echo "✅ Delegated users endpoint test completed — only Editors should succeed (HTTP 200)."
