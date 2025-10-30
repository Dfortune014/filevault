import os
import json
import boto3
import uuid
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta

# Initialize AWS resources
dynamodb = boto3.resource("dynamodb")
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

    # Identify actor (admin or system)
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    actor_id = claims.get("sub", "system")
    actor_email = claims.get("email", "system@internal")
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")

    # Extract path parameters
    path_params = event.get("pathParameters") or {}
    viewer_id = path_params.get("id")

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    delegated_editor_id = (
        body.get("delegatedEditor")
        or body.get("editorId")
        or None
    )

    if not viewer_id:
        return response(400, {"error": "Missing userId in path parameters"})

    # ============================================================
    # 🧩 Case 1: Assign or reassign a Viewer to an Editor
    # ============================================================
    if delegated_editor_id:
        print(f"Assigning Viewer {viewer_id} → Editor {delegated_editor_id}")
        try:
            result = table.update_item(
                Key={"userId": viewer_id},
                UpdateExpression="SET delegatedEditor = :e, updatedAt = :t",
                ExpressionAttributeValues={
                    ":e": delegated_editor_id,
                    ":t": datetime.utcnow().isoformat()
                },
                ReturnValues="UPDATED_NEW"
            )
            log_event(
                "DelegationAssigned",
                actor={"id": actor_id, "email": actor_email},
                target={"id": viewer_id},
                details={"assignedEditor": delegated_editor_id},
                ip=ip
            )
            print(f"✅ Viewer {viewer_id} assigned to Editor {delegated_editor_id}")
            return response(200, {
                "message": f"Viewer {viewer_id} assigned to Editor {delegated_editor_id}",
                "updated": result.get("Attributes", {})
            })
        except Exception as e:
            print(f"❌ Error updating delegate: {e}")
            log_event(
                "DelegationUpdateFailed",
                actor={"id": actor_id, "email": actor_email},
                target={"id": viewer_id},
                status="FAILED",
                details={"error": str(e), "delegatedEditor": delegated_editor_id},
                ip=ip
            )
            return response(500, {"error": "Failed to update delegation", "details": str(e)})

    # ============================================================
    # 🧩 Case 2: Remove all Viewers linked to a demoted Editor
    # ============================================================
    else:
        print(f"Removing all Viewers assigned to demoted Editor {viewer_id}")
        log_event(
            "DelegationCleanupStarted",
            actor={"id": actor_id, "email": actor_email},
            target={"id": viewer_id},
            details={"reason": "Editor demoted to Viewer"},
            ip=ip
        )

        try:
            resp = table.query(
                IndexName="delegatedEditor-index",
                KeyConditionExpression=Key("delegatedEditor").eq(viewer_id)
            )
            viewers = resp.get("Items", [])
            print(f"DEBUG Found {len(viewers)} viewers to unlink.")

            for v in viewers:
                table.update_item(
                    Key={"userId": v["userId"]},
                    UpdateExpression="REMOVE delegatedEditor"
                )
                print(f"✅ Unlinked Viewer {v['userId']} from Editor {viewer_id}")
                log_event(
                    "DelegationUnlinked",
                    actor={"id": actor_id, "email": actor_email},
                    target={"id": v["userId"]},
                    details={"previousEditor": viewer_id},
                    ip=ip
                )

            return response(200, {
                "message": f"Unlinked {len(viewers)} viewer(s) from demoted editor {viewer_id}"
            })
        except Exception as e:
            print(f"❌ Error cleaning up viewers: {e}")
            log_event(
                "DelegationUpdateFailed",
                actor={"id": actor_id, "email": actor_email},
                target={"id": viewer_id},
                status="FAILED",
                details={"error": str(e), "operation": "cleanup"},
                ip=ip
            )
            return response(500, {"error": "Failed to unlink viewers", "details": str(e)})


# ✅ Helper for consistent CORS & responses
def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "PATCH,OPTIONS",
        },
        "body": json.dumps(body)
    }
