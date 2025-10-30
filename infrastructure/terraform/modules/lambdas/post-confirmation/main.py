import os
import json
import boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")

USERS_TABLE = os.environ["USERS_TABLE"]

def lambda_handler(event, context):
    print("DEBUG event:", json.dumps(event))

    user_pool_id = event["userPoolId"]
    username = event["userName"]  # Cognito username (often same as sub)
    attributes = event["request"]["userAttributes"]

    # ✅ Extract Cognito attributes
    sub = attributes.get("sub")                # the unique userId (UUID)
    email = attributes.get("email")
    given_name = attributes.get("given_name", "")
    family_name = attributes.get("family_name", "")
    full_name = attributes.get("name") or f"{given_name} {family_name}".strip()

    if not sub or not email:
        print(f"⚠️ Missing sub or email for user {username}. Skipping DynamoDB insert.")
        return event

    # 1️⃣ Add user to the "Viewers" group (if not already)
    try:
        cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName="Viewers"
        )
        print(f"✅ Added user {username} to 'Viewers' group.")
    except cognito.exceptions.ResourceNotFoundException:
        print(f"⚠️ 'Viewers' group not found in User Pool {user_pool_id}.")
    except cognito.exceptions.InvalidParameterException as e:
        print(f"⚠️ Could not add user {username} to group: {e}")
    except Exception as e:
        print(f"⚠️ Unexpected error adding user {username} to group: {e}")

    # 2️⃣ Insert or ensure record in DynamoDB
    table = dynamodb.Table(USERS_TABLE)

    item = {
        "userId": sub,              # ✅ Primary key now uses Cognito sub
        "email": email,
        "name": full_name,
        "role": "Viewer",
        "delegatedEditor": None,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }

    # Remove None/empty values
    clean_item = {k: v for k, v in item.items() if v not in [None, ""]}

    try:
        table.put_item(
            Item=clean_item,
            ConditionExpression="attribute_not_exists(userId)"
        )
        print(f"✅ User {username} ({sub}) inserted into {USERS_TABLE}")
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        print(f"ℹ️ User {username} already exists in {USERS_TABLE}. Skipping insert.")
    except Exception as e:
        print(f"❌ Error inserting user {username} into DynamoDB: {e}")

    return event  # must always return event so Cognito continues
