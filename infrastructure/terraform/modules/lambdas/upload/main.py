import json
import boto3
import os
import uuid

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]
KMS_KEY = os.environ["KMS_KEY_ID"]

def handler(event, context):
    try:
        # 🔐 Extract Cognito groups from JWT claims
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
        groups = claims.get("cognito:groups", "")

        if not any(g in groups for g in ["Admins", "Editors"]):
            return {
                "statusCode": 403,
                "body": json.dumps({"error": "Not authorized to upload"})
            }

        # 🆔 Generate unique file ID and key
        file_id = str(uuid.uuid4())
        key = f"uploads/{file_id}.dat"

        # 🎟️ Create presigned URL with SSE-KMS
        url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET,
                "Key": key,
                "ServerSideEncryption": "aws:kms",
                "SSEKMSKeyId": KMS_KEY
            },
            ExpiresIn=3600
        )

        return {
            "statusCode": 200,
            "body": json.dumps({"uploadUrl": url, "fileId": file_id})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
