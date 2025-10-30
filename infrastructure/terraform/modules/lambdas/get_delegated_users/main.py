import os
import json
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
USERS_TABLE = os.getenv("USERS_TABLE")

users_table = dynamodb.Table(USERS_TABLE)

def handler(event, context):
    print("DEBUG event:", json.dumps(event))

    # --- Extract user identity ---
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    groups = claims.get("cognito:groups", [])

    # Normalize groups into list
    if isinstance(groups, str):
        groups = [g.strip() for g in groups.strip("[]").replace('"', "").split(",") if g.strip()]

    if not user_id:
        return response(403, {"error": "Unauthorized – no user ID found"})

    # --- Only Editors allowed ---
    if "Editors" not in groups:
        return response(403, {"error": "Forbidden – only Editors can access this endpoint"})

    try:
        # Query DynamoDB GSI on delegatedEditor
        resp = users_table.query(
            IndexName="delegatedEditor-index",
            KeyConditionExpression=Key("delegatedEditor").eq(user_id)
        )
        viewers = resp.get("Items", [])
        print(f"Found {len(viewers)} delegated viewers for {user_id}")

        result = [
            {
                "userId": v.get("userId"),
                "email": v.get("email"),
                "name": v.get("name", "Unknown"),
                "role": v.get("role", "Viewers")
            }
            for v in viewers
        ]

        return response(200, {"delegatedViewers": result})

    except Exception as e:
        print(f"ERROR querying delegated viewers: {e}")
        return response(500, {"error": "Failed to fetch delegated viewers", "details": str(e)})


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization"
        },
        "body": json.dumps(body),
    }
