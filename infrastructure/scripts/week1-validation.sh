#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="filevault"
FILES_BUCKET="${PROJECT_NAME}-files"
REGION="us-east-1"

echo "🔎 Validating Week 1 Infrastructure..."

# 1. Check S3 bucket exists
echo "📦 Checking S3 bucket..."
if aws s3api head-bucket --bucket "$FILES_BUCKET" --region "$REGION" 2>/dev/null; then
  echo "✅ Bucket $FILES_BUCKET exists"
else
  echo "❌ Bucket $FILES_BUCKET missing"
fi

# 2. Verify encryption
echo "🔐 Checking bucket encryption..."
aws s3api get-bucket-encryption --bucket "$FILES_BUCKET" --region "$REGION" \
  && echo "✅ Encryption enabled" \
  || echo "❌ Encryption not enabled"

# 3. Check versioning
echo "🗂 Checking bucket versioning..."
aws s3api get-bucket-versioning --bucket "$FILES_BUCKET" --region "$REGION"

# 4. Check lifecycle rules
echo "📜 Checking lifecycle rules..."
aws s3api get-bucket-lifecycle-configuration --bucket "$FILES_BUCKET" --region "$REGION" || echo "⚠️ No lifecycle rules configured"

# 5. Validate CloudTrail
echo "📡 Checking CloudTrail trails..."
aws cloudtrail describe-trails --region "$REGION" \
  --query "trailList[].{Name:Name,S3BucketName:S3BucketName,MultiRegion:IsMultiRegionTrail}" \
  --output table

echo "🎉 Week 1 validation complete!"
