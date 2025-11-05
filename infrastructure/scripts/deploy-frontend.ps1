# Deploy Frontend to S3 (Website Hosting Mode)
# Run this after terraform apply

param(
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "=== FileVault Frontend Deployment (S3 Website Hosting) ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Get bucket name from Terraform output
Push-Location "..\terraform"
$bucketName = terraform output -raw frontend_bucket_id
$websiteUrl = terraform output -raw frontend_url
Pop-Location

if (-not $bucketName) {
    Write-Error "Failed to get S3 bucket name from Terraform"
    exit 1
}

Write-Host "S3 Bucket: $bucketName" -ForegroundColor Green
Write-Host "Website URL: $websiteUrl" -ForegroundColor Green

# Build frontend
Write-Host "`nBuilding frontend..." -ForegroundColor Cyan
Push-Location "..\..\frontend"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed"
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green

# Deploy to S3
Write-Host "`nDeploying to S3..." -ForegroundColor Cyan
aws s3 sync dist/ "s3://$bucketName" --delete --cache-control "public, max-age=31536000, immutable"

if ($LASTEXITCODE -ne 0) {
    Write-Error "S3 deployment failed"
    exit 1
}

Write-Host "S3 deployment successful!" -ForegroundColor Green

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Frontend URL: $websiteUrl" -ForegroundColor Cyan
Write-Host "Note: This is HTTP-only (no HTTPS). For production, enable CloudFront." -ForegroundColor Yellow