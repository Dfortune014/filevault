import json
import boto3
import os

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]

def handler(event, context):
    try:
        # 🔐 Extract Cognito groups
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
        groups = claims.get("cognito:groups", "")

        if not any(g in groups for g in ["Admins", "Editors"]):
            return {
                "statusCode": 403,
                "body": json.dumps({"error": "Not authorized to download"})
            }

        # 🆔 Get file_id from pathParameters safely
        file_id = None
        if "pathParameters" in event and event["pathParameters"]:
            file_id = event["pathParameters"].get("id")

        if not file_id:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing file ID"})
            }

        # 🎟️ Generate presigned URL
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": f"uploads/{file_id}.dat"},
            ExpiresIn=3600
        )

        return {
            "statusCode": 200,
            "body": json.dumps({"downloadUrl": url})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
