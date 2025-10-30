import os
import json
import uuid
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

# Initialize AWS resources
dynamodb = boto3.resource("dynamodb")
files_table = dynamodb.Table(os.environ["FILES_TABLE"])
users_table = dynamodb.Table(os.environ["USERS_TABLE"])
GENERAL_AUDIT_TABLE = os.getenv("GENERAL_AUDIT_TABLE")
audit_table = dynamodb.Table(GENERAL_AUDIT_TABLE)

# --- Audit Logger ---
def log_event(event_type, actor, status="SUCCESS", details=None, ip=None):
    record = {
        "auditId": str(uuid.uuid4()),
        "eventType": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "actorUserId": actor.get("id"),
        "actorEmail": actor.get("email"),
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

def handler(event, context):
    print("DEBUG event:", json.dumps(event))
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")

    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    user_email = claims.get("email")
    groups_claim = claims.get("cognito:groups", [])
    groups = _normalize_groups(groups_claim)

    print(f"DEBUG user_id={user_id}, email={user_email}, groups={groups}")
    actor = {"id": user_id, "email": user_email}

    try:
        if "Admins" in groups:
            files = _list_all_files()
        elif "Editors" in groups:
            files = _list_editor_files(user_id)
        else:
            files = _list_viewer_files(user_id, user_email)

        log_event(
            "FilesListed",
            actor=actor,
            details={"group": groups[0] if groups else "None", "fileCount": len(files)},
            ip=ip
        )

        return success(files)
    except Exception as e:
        print(f"❌ ERROR main handler: {e}")
        log_event(
            "ListFailed",
            actor=actor,
            status="FAILED",
            details={"error": str(e)},
            ip=ip
        )
        return failure(str(e))

# ------------------------------------------------------------------
# 1️⃣ Admin – sees every file
def _list_all_files():
    resp = files_table.scan()
    return resp.get("Items", [])

# ------------------------------------------------------------------
# 2️⃣ Editor – own + delegated viewers’ files
def _list_editor_files(editor_id):
    delegated_resp = users_table.query(
        IndexName="delegatedEditor-index",
        KeyConditionExpression=Key("delegatedEditor").eq(editor_id)
    )
    delegated_items = delegated_resp.get("Items", [])
    viewer_ids = [v["userId"] for v in delegated_items]
    allowed_ids = [editor_id] + viewer_ids

    all_files = []
    for uid in allowed_ids:
        q = files_table.query(
            IndexName="ownerId-index",
            KeyConditionExpression=Key("ownerId").eq(uid)
        )
        items = q.get("Items", [])
        all_files.extend(items)
    return all_files

# ------------------------------------------------------------------
# 3️⃣ Viewer – only own files
def _list_viewer_files(viewer_id, viewer_email):
    q = files_table.query(
        IndexName="ownerId-index",
        KeyConditionExpression=Key("ownerId").eq(viewer_id)
    )
    items = q.get("Items", [])
    return items

# ------------------------------------------------------------------
# ✅ Helpers
def _normalize_groups(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        return [g.strip() for g in raw.strip("[]").replace('"', "").replace("'", "").split(",") if g.strip()]
    return []

def success(items):
    return {
        "statusCode": 200,
        "headers": cors_headers(),
        "body": json.dumps({"files": items}, default=str),
    }

def failure(error):
    return {
        "statusCode": 500,
        "headers": cors_headers(),
        "body": json.dumps({"error": str(error)}),
    }

def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
