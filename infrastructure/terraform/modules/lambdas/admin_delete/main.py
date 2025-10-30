import json, boto3, os, datetime
from botocore.exceptions import ClientError

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET = os.environ["BUCKET_NAME"]
FILES_TABLE = os.environ["FILES_TABLE"]
AUDIT_TABLE = os.environ["AUDIT_TABLE"]

files_table = dynamodb.Table(FILES_TABLE)
audit_table = dynamodb.Table(AUDIT_TABLE)

def handler(event, context):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    email = claims.get("email")
    groups = claims.get("cognito:groups", [])
    if isinstance(groups, str):
        groups = [g.strip() for g in groups.strip("[]").replace('"','').replace("'",'').split(",") if g.strip()]

    if "Admins" not in groups:
        return _response(403, {"error": "Admins only – audit route"})

    file_id = event.get("pathParameters", {}).get("id")
    if not file_id:
        return _response(400, {"error": "Missing file ID"})

    file_item = files_table.get_item(Key={"fileId": file_id}).get("Item")
    if not file_item:
        return _response(404, {"error": "File not found"})

    owner_id = file_item.get("ownerId", "unknown")

    try:
        s3.delete_object(Bucket=BUCKET, Key=f"uploads/{file_id}")
        files_table.delete_item(Key={"fileId": file_id})
    except ClientError as e:
        return _response(500, {"error": str(e)})

    # 🔒 Audit record
    audit_table.put_item(Item={
        "auditId": f"{file_id}-{datetime.datetime.utcnow().isoformat()}",
        "fileId": file_id,
        "deletedBy": user_id,
        "deletedByEmail": email,
        "deletedAt": datetime.datetime.utcnow().isoformat(),
        "ownerId": owner_id,
        "action": "DELETE"
    })

    return _response(200, {"deleted": file_id, "auditLogged": True})


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "DELETE,OPTIONS"
        },
        "body": json.dumps(body)
    }
