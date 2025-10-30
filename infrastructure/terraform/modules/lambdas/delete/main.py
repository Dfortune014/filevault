import os
import json
import boto3
import uuid
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

# ───────────────────────────────────────────
# AWS Clients & Environment
# ───────────────────────────────────────────
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET = os.environ["BUCKET_NAME"]
FILES_TABLE = os.environ["FILES_TABLE"]
USERS_TABLE = os.environ["USERS_TABLE"]
GENERAL_AUDIT_TABLE = os.getenv("GENERAL_AUDIT_TABLE")
DELETION_AUDIT_TABLE = os.getenv("DELETION_AUDIT_TABLE")

files_table = dynamodb.Table(FILES_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

# ───────────────────────────────────────────
# Audit Logger
# ───────────────────────────────────────────
def log_event(event_type, actor, target=None, file_id=None, status="SUCCESS", details=None, ip=None, is_admin=False):
    table_name = DELETION_AUDIT_TABLE if is_admin else GENERAL_AUDIT_TABLE
    table = dynamodb.Table(table_name)

    record = {
        "auditId": str(uuid.uuid4()),
        "eventType": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "actorUserId": actor.get("id"),
        "actorEmail": actor.get("email"),
        "targetUserId": target.get("id") if target else None,
        "fileId": file_id,
        "status": status,
        "ipAddress": ip,
        "details": details or {},
        "ttl": int((datetime.utcnow() + timedelta(days=90)).timestamp())
    }

    print("AUDIT_LOG:", json.dumps(record))
    try:
        table.put_item(Item=record)
    except Exception as e:
        print(f"⚠️ Failed to write audit log: {e}")

# ───────────────────────────────────────────
# Lambda Handler
# ───────────────────────────────────────────
def handler(event, context):
    print("DEBUG event:", json.dumps(event))

    # Handle CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {"message": "CORS preflight OK"})

    # Extract identity & IP
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    email = claims.get("email", "unknown")
    raw_groups = claims.get("cognito:groups", [])
    groups = _normalize_groups(raw_groups)
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")

    if not user_id:
        return _response(403, {"error": "Unauthorized – missing user identity"})

    file_id = event.get("pathParameters", {}).get("id")
    if not file_id:
        return _response(400, {"error": "Missing file ID"})

    # Lookup file owner
    try:
        file_item = files_table.get_item(Key={"fileId": file_id}).get("Item")
    except ClientError as e:
        log_event("FileDeleteFailed", {"id": user_id, "email": email},
                  file_id=file_id, status="FAILED",
                  details={"error": str(e)}, ip=ip, is_admin=("Admins" in groups))
        return _response(500, {"error": "Failed to read file metadata"})

    if not file_item:
        log_event("FileDeleteFailed", {"id": user_id, "email": email},
                  file_id=file_id, status="FAILED",
                  details={"reason": "File not found"}, ip=ip, is_admin=("Admins" in groups))
        return _response(404, {"error": f"File not found: {file_id}"})

    owner_id = file_item["ownerId"]

    # Authorization Logic
    authorized = False
    if "Admins" in groups:
        authorized = True
    elif "Editors" in groups:
        try:
            owner = users_table.get_item(Key={"userId": owner_id}).get("Item", {})
            if owner_id == user_id or owner.get("delegatedEditor") == user_id:
                authorized = True
        except ClientError as e:
            print("Error checking delegated editor:", e)
    elif "Viewers" in groups and owner_id == user_id:
        authorized = True

    if not authorized:
        log_event("UnauthorizedDeleteAttempt", {"id": user_id, "email": email},
                  target={"id": owner_id}, file_id=file_id,
                  status="DENIED", ip=ip)
        return _response(403, {"error": "Not authorized to delete this file"})

    # Perform Deletion
    try:
        s3_key = file_item.get("s3Key", f"uploads/{owner_id}/{file_id}")
        s3.delete_object(Bucket=BUCKET, Key=s3_key)
        files_table.delete_item(Key={"fileId": file_id})
        log_event("FileDeleted", {"id": user_id, "email": email},
                  target={"id": owner_id}, file_id=file_id,
                  ip=ip, is_admin=("Admins" in groups))
    except ClientError as e:
        log_event("FileDeleteFailed", {"id": user_id, "email": email},
                  target={"id": owner_id}, file_id=file_id,
                  status="FAILED", details={"error": str(e)}, ip=ip,
                  is_admin=("Admins" in groups))
        return _response(500, {"error": "Failed to delete file"})

    return _response(200, {
        "deleted": file_id,
        "deletedBy": user_id,
        "groups": groups
    })

# ───────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────
def _normalize_groups(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        return [g.strip() for g in raw.strip("[]").replace('"', '').replace("'", '').split(",") if g.strip()]
    return []

def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
        "body": json.dumps(body),
    }
