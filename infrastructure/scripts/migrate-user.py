import boto3
from datetime import datetime

region = "us-east-1"
dynamodb = boto3.resource("dynamodb", region_name=region)
table = dynamodb.Table("FileVaultUsers")

def main():
    print("🔍 Backfilling missing roles and delegatedEditor fields")
    resp = table.scan()
    items = resp.get("Items", [])
    updated = 0

    for user in items:
        user_id = user.get("userId")
        email = user.get("email")
        role = user.get("role")
        if not role:
            print(f"⚙️  Updating {email or user_id} → role=Viewer, delegatedEditor=None")
            table.update_item(
                Key={"userId": user_id},
                UpdateExpression="SET #r = :r, delegatedEditor = :d, updatedAt = :u",
                ExpressionAttributeNames={"#r": "role"},
                ExpressionAttributeValues={
                    ":r": "Viewer",
                    ":d": None,
                    ":u": datetime.utcnow().isoformat(),
                },
            )
            updated += 1

    print(f"✅ Backfill complete. Updated {updated} user(s).")

if __name__ == "__main__":
    main()
