import os
import boto3
from boto3.dynamodb.conditions import Key
import json
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["USERS_TABLE"])

# helper to encode DynamoDB Decimal safely into JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

def lambda_handler(event, context):
    # Debug: print full event for inspection
    print("DEBUG full event:", json.dumps(event, indent=2))

    # --- Extract Claims ---
    claims = {}
    if "requestContext" in event and "authorizer" in event["requestContext"]:
        auth_ctx = event["requestContext"]["authorizer"]
        if "jwt" in auth_ctx:  # HTTP API format
            claims = auth_ctx.get("jwt", {}).get("claims", {})
        elif "claims" in auth_ctx:  # REST API format
            claims = auth_ctx.get("claims", {})

    print("DEBUG authorizer claims:", json.dumps(claims, indent=2))

    # --- Normalize Groups ---
    groups_claim = claims.get("cognito:groups", [])
    if isinstance(groups_claim, str):
        cleaned = groups_claim.strip("[]").replace("'", "").replace('"', "")
        groups = [g.strip() for g in cleaned.split(",") if g.strip()]
    elif isinstance(groups_claim, list):
        groups = groups_claim
    else:
        groups = []

    print("DEBUG normalized groups:", groups)

    # --- Authorization Guard ---
    if "Admins" not in groups:
        print("DEBUG forbidden request, groups:", groups)
        return {
            "statusCode": 403,
            "body": json.dumps({"error": "Forbidden – Admins only", "debug_groups": groups})
        }

    # --- Business Logic: List Users ---
    params = event.get("queryStringParameters") or {}
    role = params.get("role")
    print("DEBUG query role filter:", role)

    try:
        if role:
            # Ensure the GSI exists before using role-index
            resp = table.query(
                IndexName="role-index",
                KeyConditionExpression=Key("role").eq(role)
            )
            items = resp.get("Items", [])
        else:
            resp = table.scan()
            items = resp.get("Items", [])

        print("DEBUG DynamoDB items:", items)

        return {
            "statusCode": 200,
            "body": json.dumps(items, cls=DecimalEncoder)
        }

    except Exception as e:
        print("ERROR listing users:", str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error", "details": str(e)})
        }
