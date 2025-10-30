import os
import json
import boto3
import uuid
from datetime import datetime, timedelta

# Initialize AWS clients
dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")
lambda_client = boto3.client("lambda")
table = dynamodb.Table(os.environ["USERS_TABLE"])

GENERAL_AUDIT_TABLE = os.getenv("GENERAL_AUDIT_TABLE")
audit_table = dynamodb.Table(GENERAL_AUDIT_TABLE)

# --- Helper: Audit Logger ---
def log_event(event_type, actor, target=None, status="SUCCESS", details=None, ip=None):
    record = {
        "auditId": str(uuid.uuid4()),
        "eventType": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "actorUserId": actor.get("id"),
        "actorEmail": actor.get("email"),
        "targetUserId": target.get("id") if target else None,
        "status": status,
        "details": details or {},
        "ipAddress": ip,
        "ttl": int((datetime.utcnow() + timedelta(days=90)).timestamp())
    }
    print("AUDIT_LOG:", json.dumps(record))
    try:
        audit_table.put_item(Item=record)
    except Exception as e:
        print(f"⚠️ Failed to log audit event: {e}")

def lambda_handler(event, context):
    print("DEBUG event:", json.dumps(event))

    user_pool_id = os.environ["USER_POOL_ID"]
    update_delegate_lambda = os.environ.get("UPDATE_DELEGATE_LAMBDA")
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")

    # --- Parse acting admin from token ---
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    actor_id = claims.get("sub")
    actor_email = claims.get("email", "unknown")

    # --- Step 0: Parse input ---
    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("id")  # target user
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}
    new_role = body.get("role")

    if not user_id or not new_role:
        return response(400, {"error": "Missing userId or role"})

    print(f"Updating user role for {user_id} → {new_role}")

    # --- Step 1: Verify user exists in DynamoDB ---
    try:
        resp = table.get_item(Key={"userId": user_id})
        item = resp.get("Item")
        if not item:
            log_event(
                "RoleUpdateFailed",
                actor={"id": actor_id, "email": actor_email},
                target={"id": user_id},
                status="FAILED",
                details={"reason": "User not found"},
                ip=ip
            )
            return response(404, {"error": f"User {user_id} not found in DynamoDB"})
        old_role = item.get("role")
        user_email = item.get("email")
    except Exception as e:
        log_event(
            "RoleUpdateFailed",
            actor={"id": actor_id, "email": actor_email},
            target={"id": user_id},
            status="FAILED",
            details={"error": str(e)},
            ip=ip
        )
        return response(500, {"error": "Failed to fetch user", "details": str(e)})

    cognito_username = user_email or user_id

    # --- Step 2: Update Cognito Groups ---
    try:
        existing_groups = cognito.admin_list_groups_for_user(
            UserPoolId=user_pool_id,
            Username=cognito_username
        ).get("Groups", [])

        for g in existing_groups:
            cognito.admin_remove_user_from_group(
                UserPoolId=user_pool_id,
                Username=cognito_username,
                GroupName=g["GroupName"]
            )
            print(f"Removed {cognito_username} from group {g['GroupName']}")
    except cognito.exceptions.UserNotFoundException:
        return response(404, {"error": f"User {cognito_username} not found in Cognito"})
    except Exception as e:
        log_event(
            "RoleUpdateFailed",
            actor={"id": actor_id, "email": actor_email},
            target={"id": user_id},
            status="FAILED",
            details={"error": f"Group removal failed: {str(e)}"},
            ip=ip
        )

    target_group = f"{new_role}s"
    try:
        cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=cognito_username,
            GroupName=target_group
        )
        print(f"✅ Added {cognito_username} to group {target_group}")
    except Exception as e:
        log_event(
            "RoleUpdateFailed",
            actor={"id": actor_id, "email": actor_email},
            target={"id": user_id},
            status="FAILED",
            details={"error": f"Group add failed: {str(e)}"},
            ip=ip
        )
        return response(500, {"error": "Failed to update Cognito group", "details": str(e)})

    # --- Step 3: Update DynamoDB record ---
    try:
        table.update_item(
            Key={"userId": user_id},
            UpdateExpression="SET #r = :r, updatedAt = :t",
            ExpressionAttributeNames={"#r": "role"},
            ExpressionAttributeValues={":r": new_role, ":t": datetime.utcnow().isoformat()}
        )
        print(f"✅ Updated DynamoDB role for {user_id} → {new_role}")
    except Exception as e:
        log_event(
            "RoleUpdateFailed",
            actor={"id": actor_id, "email": actor_email},
            target={"id": user_id},
            status="FAILED",
            details={"error": f"DynamoDB update failed: {str(e)}"},
            ip=ip
        )
        return response(500, {"error": "Failed to update DynamoDB", "details": str(e)})

    # --- Step 4: Delegate cleanup for demoted editors ---
    try:
        if new_role.lower() == "viewer" and update_delegate_lambda:
            lambda_client.invoke(
                FunctionName=update_delegate_lambda,
                InvocationType="Event",
                Payload=json.dumps({
                    "pathParameters": {"id": user_id},
                    "body": json.dumps({"delegatedEditor": None})
                })
            )
            log_event(
                "DelegateCleanupTriggered",
                actor={"id": actor_id, "email": actor_email},
                target={"id": user_id},
                details={"reason": "Demoted to Viewer"},
                ip=ip
            )
    except Exception as e:
        log_event(
            "DelegateCleanupFailed",
            actor={"id": actor_id, "email": actor_email},
            target={"id": user_id},
            status="FAILED",
            details={"error": str(e)},
            ip=ip
        )

    # --- Step 5: Success Audit ---
    log_event(
        "UserRoleUpdated",
        actor={"id": actor_id, "email": actor_email},
        target={"id": user_id},
        details={"oldRole": old_role, "newRole": new_role},
        ip=ip
    )

    return response(200, {
        "message": f"User {user_id} ({cognito_username}) successfully changed to {new_role}",
        "autoCleanupTriggered": new_role.lower() == "viewer"
    })


# ✅ Helper for clean responses
def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "PATCH,OPTIONS"
        },
        "body": json.dumps(body)
    }
