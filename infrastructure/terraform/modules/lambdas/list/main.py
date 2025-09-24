import json
import boto3
import os

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]

def handler(event, context):
    try:
        resp = s3.list_objects_v2(Bucket=BUCKET)
        files = [obj["Key"] for obj in resp.get("Contents", [])]

        return {
            "statusCode": 200,
            "body": json.dumps({"files": files})
        }
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
