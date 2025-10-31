# PowerShell script to destroy all FileVault infrastructure
# This will delete all AWS resources including S3 buckets, DynamoDB tables, Lambda functions, etc.

$ErrorActionPreference = "Stop"

Write-Host "🗑️  FileVault Infrastructure Destroy Script" -ForegroundColor Red
Write-Host ""

# Confirmation
$confirmation = Read-Host "This will DELETE ALL infrastructure. Are you sure? Type 'yes' to continue"
if ($confirmation -ne "yes") {
    Write-Host "❌ Cancelled" -ForegroundColor Yellow
    exit 0
}

# Get Terraform directory
$terraformDir = Join-Path $PSScriptRoot "..\terraform"

# Step 1: Get Terraform outputs to identify resources
Write-Host ""
Write-Host "📊 Getting Terraform outputs..." -ForegroundColor Cyan
Push-Location $terraformDir

try {
    # Get bucket names and other critical info
    $bucketName = terraform output -raw bucket_name 2>$null
    $cloudtrailBucket = terraform output -raw cloudtrail_bucket 2>$null
    $region = "us-east-1"
    
    Write-Host "Bucket: $bucketName" -ForegroundColor Gray
    Write-Host "CloudTrail Bucket: $cloudtrailBucket" -ForegroundColor Gray
}
catch {
    Write-Host "⚠️  Could not read Terraform outputs. Will attempt destroy anyway." -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Empty S3 buckets (required before destroy due to force_destroy=false)
Write-Host "🗑️  Step 1: Emptying S3 buckets..." -ForegroundColor Cyan

function Empty-S3Bucket {
    param([string]$BucketName)
    
    if ([string]::IsNullOrEmpty($BucketName)) {
        return
    }
    
    Write-Host "  Emptying bucket: $BucketName" -ForegroundColor Gray
    
    try {
        # Delete all object versions first (because versioning is enabled)
        $versions = aws s3api list-object-versions --bucket $BucketName --region $region 2>$null | ConvertFrom-Json
        if ($versions.Versions) {
            foreach ($version in $versions.Versions) {
                $key = $version.Key
                $versionId = $version.VersionId
                aws s3api delete-object --bucket $BucketName --key $key --version-id $versionId --region $region 2>$null | Out-Null
            }
            Write-Host "    ✅ Deleted $($versions.Versions.Count) object versions" -ForegroundColor Green
        }
        
        # Delete delete markers
        if ($versions.DeleteMarkers) {
            foreach ($marker in $versions.DeleteMarkers) {
                $key = $marker.Key
                $versionId = $marker.VersionId
                aws s3api delete-object --bucket $BucketName --key $key --version-id $versionId --region $region 2>$null | Out-Null
            }
            Write-Host "    ✅ Deleted $($versions.DeleteMarkers.Count) delete markers" -ForegroundColor Green
        }
        
        # Use AWS CLI to remove all objects (faster)
        aws s3 rm "s3://$BucketName" --recursive --region $region 2>$null | Out-Null
        
        Write-Host "    ✅ Bucket $BucketName emptied" -ForegroundColor Green
    }
    catch {
        Write-Host "    ⚠️  Could not empty bucket $BucketName (might not exist): $_" -ForegroundColor Yellow
    }
}

# Empty the buckets
if (-not [string]::IsNullOrEmpty($bucketName)) {
    Empty-S3Bucket $bucketName
}
if (-not [string]::IsNullOrEmpty($cloudtrailBucket)) {
    Empty-S3Bucket $cloudtrailBucket
}

Write-Host ""

# Step 3: Run terraform destroy
Write-Host "🗑️  Step 2: Running Terraform destroy..." -ForegroundColor Cyan
Write-Host "  This will delete: VPC, Lambda functions, API Gateway, Cognito, DynamoDB, KMS, IAM roles..." -ForegroundColor Gray
Write-Host ""

terraform destroy -auto-approve

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Infrastructure successfully destroyed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: If you have a Terraform state backend (S3 + DynamoDB), you may need to manually delete:" -ForegroundColor Yellow
    Write-Host "  - filevault-tfstate-new S3 bucket" -ForegroundColor Yellow
    Write-Host "  - filevault-lock DynamoDB table" -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "❌ Terraform destroy failed. Check errors above." -ForegroundColor Red
    Write-Host "You may need to manually delete remaining resources." -ForegroundColor Yellow
}

Pop-Location

Write-Host ""
Write-Host "🏁 Destroy script complete!" -ForegroundColor Cyan
