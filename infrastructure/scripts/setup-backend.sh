#!/usr/bin/env bash
set -euo pipefail

# === CONFIGURATION ===
PROJECT_NAME="filevault"
REGION="us-east-1"
STATE_BUCKET="${PROJECT_NAME}-tfstate"
LOCK_TABLE="${PROJECT_NAME}-lock"

echo " Setting up Terraform backend in region: $REGION"

# === CREATE S3 BUCKET FOR STATE ===
if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  echo " S3 bucket $STATE_BUCKET already exists"
else
  echo " Creating S3 bucket: $STATE_BUCKET"
  aws s3api create-bucket \
    --bucket "$STATE_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"

  aws s3api put-bucket-encryption \
    --bucket "$STATE_BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [
        {
          "ApplyServerSideEncryptionByDefault": {
            "SSEAlgorithm": "AES256"
          }
        }
      ]
    }'

  echo " S3 bucket $STATE_BUCKET created and encrypted"
fi

# === CREATE DYNAMODB TABLE FOR STATE LOCKING ===
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo " DynamoDB table $LOCK_TABLE already exists"
else
  echo " Creating DynamoDB table: $LOCK_TABLE"
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"

  echo " DynamoDB table $LOCK_TABLE created"
fi

echo "Terraform backend setup complete!"
