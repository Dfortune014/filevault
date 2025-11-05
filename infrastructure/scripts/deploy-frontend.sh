#!/bin/bash
# Deploy Frontend to S3 (Website Hosting Mode)
# Run this after terraform apply

set -e  # Exit on error

# Default environment
ENVIRONMENT="${1:-dev}"

echo "=== FileVault Frontend Deployment (S3 Website Hosting) ==="
echo "Environment: $ENVIRONMENT"

# Get bucket name from Terraform output
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

cd "$TERRAFORM_DIR"
BUCKET_NAME=$(terraform output -raw frontend_bucket_id)
WEBSITE_URL=$(terraform output -raw frontend_url)
cd - > /dev/null

if [ -z "$BUCKET_NAME" ]; then
    echo "Error: Failed to get S3 bucket name from Terraform" >&2
    exit 1
fi

echo "S3 Bucket: $BUCKET_NAME"
echo "Website URL: $WEBSITE_URL"

# Build frontend
echo ""
echo "Building frontend..."
FRONTEND_DIR="$SCRIPT_DIR/../../frontend"
cd "$FRONTEND_DIR"
npm run build

if [ $? -ne 0 ]; then
    echo "Error: Frontend build failed" >&2
    exit 1
fi

echo "Build successful!"

# Deploy to S3
echo ""
echo "Deploying to S3..."
aws s3 sync dist/ "s3://$BUCKET_NAME" --delete --cache-control "public, max-age=31536000, immutable"

if [ $? -ne 0 ]; then
    echo "Error: S3 deployment failed" >&2
    exit 1
fi

echo "S3 deployment successful!"

echo ""
echo "=== Deployment Complete ==="
echo "Frontend URL: $WEBSITE_URL"
echo "Note: This is HTTP-only (no HTTPS). For production, enable CloudFront."