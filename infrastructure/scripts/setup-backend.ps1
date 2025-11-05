# PowerShell script to set up Terraform backend (S3 bucket and DynamoDB lock table)
# This must be run before terraform init/plan/apply

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$STATE_BUCKET = "filevault-tfstate-new"
$LOCK_TABLE = "filevault-lock"

Write-Host "=== Setting up Terraform backend in region: $REGION ===" -ForegroundColor Cyan
Write-Host ""

# === CREATE S3 BUCKET FOR STATE ===
Write-Host "Checking S3 bucket: $STATE_BUCKET..." -ForegroundColor Gray
try {
    aws s3api head-bucket --bucket "$STATE_BUCKET" 2>$null | Out-Null
    Write-Host "  S3 bucket $STATE_BUCKET already exists" -ForegroundColor Green
}
catch {
    Write-Host "  Creating S3 bucket: $STATE_BUCKET" -ForegroundColor Yellow
    try {
        # For us-east-1, LocationConstraint is not allowed
        if ($REGION -eq "us-east-1") {
            aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$REGION" 2>$null | Out-Null
        } else {
            $config = @{LocationConstraint=$REGION} | ConvertTo-Json
            aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$REGION" --create-bucket-configuration $config 2>$null | Out-Null
        }

        # Enable encryption
        $encryptionConfig = @{
            Rules = @(
                @{
                    ApplyServerSideEncryptionByDefault = @{
                        SSEAlgorithm = "AES256"
                    }
                }
            )
        } | ConvertTo-Json -Compress

        aws s3api put-bucket-encryption --bucket "$STATE_BUCKET" --server-side-encryption-configuration $encryptionConfig 2>$null | Out-Null

        # Enable versioning (recommended for state files)
        aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" --versioning-configuration Status=Enabled 2>$null | Out-Null

        Write-Host "  SUCCESS: S3 bucket $STATE_BUCKET created, encrypted, and versioning enabled" -ForegroundColor Green
    }
    catch {
        Write-Host "  ERROR: Failed to create S3 bucket: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# === CREATE DYNAMODB TABLE FOR STATE LOCKING ===
Write-Host "Checking DynamoDB table: $LOCK_TABLE..." -ForegroundColor Gray
try {
    aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" 2>$null | Out-Null
    Write-Host "  DynamoDB table $LOCK_TABLE already exists" -ForegroundColor Green
}
catch {
    Write-Host "  Creating DynamoDB table: $LOCK_TABLE" -ForegroundColor Yellow
    try {
        aws dynamodb create-table `
            --table-name "$LOCK_TABLE" `
            --attribute-definitions AttributeName=LockID,AttributeType=S `
            --key-schema AttributeName=LockID,KeyType=HASH `
            --billing-mode PAY_PER_REQUEST `
            --region "$REGION" `
            2>$null | Out-Null

        Write-Host "  Waiting for table to become active..." -ForegroundColor Gray
        Start-Sleep -Seconds 5

        # Wait for table to be active
        $maxWait = 30
        $waited = 0
        do {
            $tableStatus = aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" 2>$null | ConvertFrom-Json
            if ($tableStatus.Table.TableStatus -eq "ACTIVE") {
                break
            }
            Start-Sleep -Seconds 2
            $waited += 2
        } while ($waited -lt $maxWait)

        Write-Host "  SUCCESS: DynamoDB table $LOCK_TABLE created" -ForegroundColor Green
    }
    catch {
        Write-Host "  ERROR: Failed to create DynamoDB table: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Terraform backend setup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run:" -ForegroundColor Cyan
Write-Host "  terraform init" -ForegroundColor Yellow
Write-Host "  terraform plan" -ForegroundColor Yellow
Write-Host "  terraform apply" -ForegroundColor Yellow
