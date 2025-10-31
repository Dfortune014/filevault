import os
import json
import boto3
import uuid
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key
from botocore.client import Config

# --- AWS clients ---
s3 = boto3.client("s3", config=Config(signature_version="s3v4"))
dynamodb = boto3.resource("dynamodb")

# --- Environment variables ---
BUCKET_NAME = os.getenv("FILES_BUCKET", "filevault-files")
KMS_KEY_ID = os.getenv("KMS_KEY_ID")
FILES_TABLE = os.getenv("FILES_TABLE")
USERS_TABLE = os.getenv("USERS_TABLE")
GENERAL_AUDIT_TABLE = os.getenv("GENERAL_AUDIT_TABLE")

files_table = dynamodb.Table(FILES_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

# --- Audit Logger ---
def log_event(event_type, actor, target=None, file_id=None, status="SUCCESS", details=None, ip=None):
    table = dynamodb.Table(GENERAL_AUDIT_TABLE)
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
    table.put_item(Item=record)


def handler(event, context):
    print("DEBUG event:", json.dumps(event))
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")

    # --- Parse user identity from token ---
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    user_email = claims.get("email")
    groups_claim = claims.get("cognito:groups", [])

    # Normalize Cognito groups
    if isinstance(groups_claim, str):
        groups = [
            g.strip()
            for g in groups_claim.strip("[]").replace('"', "").replace("'", "").split(",")
            if g.strip()
        ]
    else:
        groups = groups_claim or []

    user_role = groups[0] if groups else "Viewers"
    print(f"DEBUG user_id={user_id}, email={user_email}, role={user_role}")

    if not user_id or not user_email:
        return response(403, {"error": "Invalid or missing user token"})

    try:
        body = json.loads(event.get("body", "{}"))
        filename = body["filename"]
        content_type = body.get("contentType", "application/octet-stream")
        target_user_id = body.get("targetUserId")
    except Exception as e:
        print(f"ERROR parsing request body: {e}")
        return response(400, {"error": f"Invalid request body: {str(e)}"})

    upload_user_id = user_id
    upload_user_email = user_email

    # --- Handle delegated upload (Admin/Editor uploading for someone else) ---
    try:
        if target_user_id and target_user_id != user_id:
            resp = users_table.get_item(Key={"userId": target_user_id})
            target_user = resp.get("Item")

            if not target_user:
                log_event("UploadFailed", {"id": user_id, "email": user_email},
                          target={"id": target_user_id}, status="FAILED",
                          details={"reason": "Target not found"}, ip=ip)
                return response(404, {"error": f"Target user {target_user_id} not found"})

            target_email = target_user.get("email", "")
            if "Admins" in groups:
                upload_user_id = target_user_id
                upload_user_email = target_email
            elif "Editors" in groups:
                delegated = users_table.query(
                    IndexName="delegatedEditor-index",
                    KeyConditionExpression=Key("delegatedEditor").eq(user_id)
                ).get("Items", [])
                delegated_ids = [v.get("userId") for v in delegated if "userId" in v]
                if target_user_id not in delegated_ids:
                    log_event("UnauthorizedUploadAttempt",
                              {"id": user_id, "email": user_email},
                              target={"id": target_user_id}, status="DENIED",
                              details={"reason": "Editor not delegated"}, ip=ip)
                    return response(403, {"error": "You are not authorized to upload for this user"})
                upload_user_id = target_user_id
                upload_user_email = target_email
            else:
                return response(403, {"error": "Only Admins or Editors can upload for others"})

    except Exception as e:
        print(f"ERROR determining upload target: {e}")
        return response(500, {"error": "Failed to verify upload target", "details": str(e)})

    file_id = str(uuid.uuid4())
    s3_key = f"uploads/{upload_user_id}/{filename}"

    # --- Generate S3 Presigned URL ---
    try:
        params = {
            "Bucket": BUCKET_NAME,
            "Key": s3_key,
            "ContentType": content_type,
            "ServerSideEncryption": "aws:kms",
        }
        if KMS_KEY_ID:
            params["SSEKMSKeyId"] = KMS_KEY_ID

        required_headers = {
            "x-amz-server-side-encryption": "aws:kms",
        }
        if KMS_KEY_ID:
            required_headers["x-amz-server-side-encryption-aws-kms-key-id"] = KMS_KEY_ID

        presigned_url = s3.generate_presigned_url(
            "put_object",
            Params=params,
            ExpiresIn=3600,
            HttpMethod="PUT"
        )
    except Exception as e:
        print(f"ERROR generating presigned URL: {e}")
        return response(500, {"error": "Failed to generate upload URL", "details": str(e)})

    # --- Record upload metadata ---
    try:
        files_table.put_item(Item={
            "fileId": file_id,
            "ownerId": upload_user_id,
            "ownerEmail": upload_user_email,
            "fileName": filename,
            "s3Key": s3_key,
            "uploadedAt": datetime.utcnow().isoformat(),
            "status": "PENDING",
            "uploadedBy": user_email,
            "roleAtUpload": user_role,
        })
        log_event("FileUploadInitiated",
                  {"id": user_id, "email": user_email},
                  target={"id": upload_user_id},
                  file_id=file_id, ip=ip)
    except Exception as e:
        print(f"ERROR writing file metadata: {e}")
        log_event("FileUploadFailed",
                  {"id": user_id, "email": user_email},
                  target={"id": upload_user_id},
                  file_id=file_id, status="FAILED",
                  details={"error": str(e)}, ip=ip)
        return response(500, {"error": "Failed to write metadata", "details": str(e)})

    # ✅ Return presigned URL + headers
    return response(200, {
        "uploadUrl": presigned_url,
        "fileKey": s3_key,
        "fileId": file_id,
        "targetOwner": upload_user_email,
        "requiredHeaders": required_headers,
    })


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }
