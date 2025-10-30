import os, json, uuid, boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

# AWS resources
s3 = boto3.client("s3", config=boto3.session.Config(signature_version="s3v4"))
dynamodb = boto3.resource("dynamodb")

BUCKET = os.environ["BUCKET_NAME"]
FILES_TABLE = os.environ["FILES_TABLE"]
USERS_TABLE = os.environ["USERS_TABLE"]
GENERAL_AUDIT_TABLE = os.getenv("GENERAL_AUDIT_TABLE")

files_table = dynamodb.Table(FILES_TABLE)
users_table = dynamodb.Table(USERS_TABLE)
audit_table = dynamodb.Table(GENERAL_AUDIT_TABLE)

# ---------- Audit Logger ----------
def log_event(event_type, actor, target=None, file_id=None, status="SUCCESS", details=None, ip=None):
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
        audit_table.put_item(Item=record)
    except Exception as e:
        print(f"⚠️ Audit log failure: {e}")

# ---------- Lambda Handler ----------
def handler(event, context):
    print("DEBUG event:", json.dumps(event))
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")

    try:
        claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
        user_id = claims.get("sub")
        user_email = claims.get("email", "unknown")
        raw_groups = claims.get("cognito:groups", [])
        groups = _normalize_groups(raw_groups)

        print(f"DEBUG User: {user_email}, Groups: {groups}")
        file_id = event.get("pathParameters", {}).get("id")
        if not file_id:
            return response(400, {"error": "Missing file ID"})

        # --- Get file metadata ---
        file_item = files_table.get_item(Key={"fileId": file_id}).get("Item")
        if not file_item:
            log_event("DownloadFailed", {"id": user_id, "email": user_email},
                      file_id=file_id, status="FAILED",
                      details={"reason": "File not found"}, ip=ip)
            return response(404, {"error": "File not found"})

        owner_id = file_item.get("ownerId")
        owner_email = file_item.get("ownerEmail")
        s3_key = file_item.get("s3Key")

        # --- Authorization ---
        allowed = False
        if "Admins" in groups:
            allowed = True
        elif "Editors" in groups:
            delegated = users_table.query(
                IndexName="delegatedEditor-index",
                KeyConditionExpression=Key("delegatedEditor").eq(user_id)
            ).get("Items", [])
            delegated_ids = [v["userId"] for v in delegated]
            allowed = (owner_id == user_id) or (owner_id in delegated_ids)
        elif "Viewers" in groups:
            allowed = (owner_id == user_id)

        if not allowed:
            log_event("UnauthorizedDownloadAttempt",
                      {"id": user_id, "email": user_email},
                      target={"id": owner_id}, file_id=file_id,
                      status="DENIED", ip=ip)
            return response(403, {"error": "Not authorized to access this file"})

        # --- Generate presigned URL ---
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": s3_key},
            ExpiresIn=3600, HttpMethod="GET"
        )

        log_event("FileDownloaded",
                  {"id": user_id, "email": user_email},
                  target={"id": owner_id}, file_id=file_id,
                  ip=ip)

        return response(200, {"downloadUrl": url, "fileName": file_item["fileName"]})

    except Exception as e:
        print("ERROR:", str(e))
        log_event("DownloadFailed",
                  {"id": user_id if 'user_id' in locals() else 'unknown',
                   "email": user_email if 'user_email' in locals() else 'unknown'},
                  file_id=file_id if 'file_id' in locals() else None,
                  status="FAILED", details={"error": str(e)}, ip=ip)
        return response(500, {"error": str(e)})

# ---------- Helpers ----------
def _normalize_groups(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        return [g.strip() for g in raw.strip("[]").replace('"', '').replace("'", '').split(",") if g.strip()]
    return []

def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(body)
    }
