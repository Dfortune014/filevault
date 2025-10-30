#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------
# Test: Admin Override Delete API
# Secure File Vault – Controlled Override (Model 2)
# -----------------------------------------

API_ENDPOINT="https://iqfnlcxwx8.execute-api.us-east-1.amazonaws.com/dev"
REGION="us-east-1"
CLIENT_ID="2v1ovouait43844e0t3gl39veh"
AUDIT_TABLE="FileVaultDeletionAuditLog"

# --- Replace with a valid fileId to test ---
TEST_FILE_ID="eb8f8e3e-e66f-4368-b860-d155fb91b08d"

# --- User credentials (use real test users) ---
declare -A USERS
USERS["Admin"]="fortune.linus@stillman.edu:Admin@12345"
USERS["Editor"]="Dfortune014@gmail.com:Fortunegad@14"
USERS["Viewer"]="linusfortune54@gmail.com:Uwama@2022"

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

# --- Helper: Call DELETE /api/admin/files/{id} ---
call_admin_delete() {
  local role="$1"
  local token="$2"
  local file_id="$3"

  echo
  echo "➡️  Testing DELETE /api/admin/files/${file_id} as $role..."
  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X DELETE \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    "$API_ENDPOINT/api/admin/files/${file_id}")

  BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
  STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

  echo "HTTP $STATUS"

  if [[ "$STATUS" == "200" ]]; then
    echo "✅ $role successfully deleted file $file_id"
    echo "$BODY" | jq '.'
  else
    echo "❌ $role failed ($STATUS)"
    echo "$BODY" | jq '.'
  fi
}

# --- Helper: Check audit logs ---
check_audit_log() {
  local file_id="$1"
  echo
  echo "🔍 Checking audit log for file: $file_id"

  aws dynamodb scan \
    --table-name "$AUDIT_TABLE" \
    --filter-expression "fileId = :f" \
    --expression-attribute-values "{\":f\":{\"S\":\"$file_id\"}}" \
    --region "$REGION" \
    --output json |
    jq '.Items[] | {
        auditId: .auditId.S,
        deletedByEmail: .deletedByEmail.S,
        deletedAt: .deletedAt.S
      }'
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
  call_admin_delete "$ROLE" "$TOKEN" "$TEST_FILE_ID"
done

# --- Audit Verification (Admin Only) ---
check_audit_log "$TEST_FILE_ID"

echo
echo "✅ Admin Delete API test completed — only Admin should succeed, and audit entry should appear."
