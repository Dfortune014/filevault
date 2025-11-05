# PowerShell script to destroy all FileVault infrastructure
# This will delete all AWS resources including S3 buckets, DynamoDB tables, Lambda functions, etc.

$ErrorActionPreference = "Stop"

Write-Host "FileVault Infrastructure Destroy Script" -ForegroundColor Red
Write-Host ""

# Confirmation
$confirmation = Read-Host "This will DELETE ALL infrastructure. Are you sure? Type 'yes' to continue"
if ($confirmation -ne "yes") {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

# Get Terraform directory
$terraformDir = Join-Path $PSScriptRoot "..\terraform"
$region = "us-east-1"

# Step 1: Get Terraform outputs to identify resources
Write-Host ""
Write-Host "Getting Terraform outputs..." -ForegroundColor Cyan
Push-Location $terraformDir

$bucketName = $null
$cloudtrailBucket = $null

try {
    # Get bucket names and other critical info
    $bucketName = terraform output -raw bucket_name 2>$null
    $cloudtrailBucket = terraform output -raw cloudtrail_bucket 2>$null
    
    Write-Host "Bucket: $bucketName" -ForegroundColor Gray
    Write-Host "CloudTrail Bucket: $cloudtrailBucket" -ForegroundColor Gray
}
catch {
    Write-Host "WARNING: Could not read Terraform outputs. Will attempt destroy anyway." -ForegroundColor Yellow
}

Write-Host ""

# Function to empty S3 buckets
function Empty-S3Bucket {
    param([string]$BucketName, [string]$Region)
    
    if ([string]::IsNullOrEmpty($BucketName)) {
        return
    }
    
    Write-Host "  Emptying bucket: $BucketName" -ForegroundColor Gray
    
    try {
        # Delete all object versions first (because versioning is enabled)
        $versions = aws s3api list-object-versions --bucket $BucketName --region $Region 2>$null | ConvertFrom-Json
        if ($versions.Versions) {
            foreach ($version in $versions.Versions) {
                $key = $version.Key
                $versionId = $version.VersionId
                aws s3api delete-object --bucket $BucketName --key $key --version-id $versionId --region $Region 2>$null | Out-Null
            }
            Write-Host "    SUCCESS: Deleted $($versions.Versions.Count) object versions" -ForegroundColor Green
        }
        
        # Delete delete markers
        if ($versions.DeleteMarkers) {
            foreach ($marker in $versions.DeleteMarkers) {
                $key = $marker.Key
                $versionId = $marker.VersionId
                aws s3api delete-object --bucket $BucketName --key $key --version-id $versionId --region $Region 2>$null | Out-Null
            }
            Write-Host "    SUCCESS: Deleted $($versions.DeleteMarkers.Count) delete markers" -ForegroundColor Green
        }
        
        # Use AWS CLI to remove all objects (faster)
        aws s3 rm "s3://$BucketName" --recursive --region $Region 2>$null | Out-Null
        
        Write-Host "    SUCCESS: Bucket $BucketName emptied" -ForegroundColor Green
    }
    catch {
        Write-Host "    WARNING: Could not empty bucket $BucketName (might not exist): $_" -ForegroundColor Yellow
    }
}

# Function to delete DynamoDB tables
function Remove-DynamoDBTable {
    param([string]$TableName, [string]$Region)
    
    if ([string]::IsNullOrEmpty($TableName)) {
        return
    }
    
    Write-Host "  Deleting DynamoDB table: $TableName" -ForegroundColor Gray
    
    try {
        # Check if table exists
        aws dynamodb describe-table --table-name $TableName --region $Region 2>$null | Out-Null
        
        # Delete the table
        aws dynamodb delete-table --table-name $TableName --region $Region 2>$null | Out-Null
        
        # Wait for deletion
        Write-Host "    Waiting for table deletion..." -ForegroundColor Gray
        $maxWait = 60
        $waited = 0
        do {
            Start-Sleep -Seconds 2
            $waited += 2
            $exists = aws dynamodb describe-table --table-name $TableName --region $Region 2>$null
        } while ($exists -and $waited -lt $maxWait)
        
        if (-not $exists) {
            Write-Host "    SUCCESS: Table $TableName deleted" -ForegroundColor Green
        } else {
            Write-Host "    WARNING: Table deletion timed out" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "    WARNING: Could not delete table $TableName (might not exist or already deleted): $_" -ForegroundColor Yellow
    }
}

# Function to delete Lambda functions
function Remove-LambdaFunction {
    param([string]$FunctionName, [string]$Region)
    
    if ([string]::IsNullOrEmpty($FunctionName)) {
        return
    }
    
    Write-Host "  Deleting Lambda function: $FunctionName" -ForegroundColor Gray
    
    try {
        # Check if function exists
        aws lambda get-function --function-name $FunctionName --region $Region 2>$null | Out-Null
        
        # Delete the function
        aws lambda delete-function --function-name $FunctionName --region $Region 2>$null | Out-Null
        
        Write-Host "    SUCCESS: Lambda function $FunctionName deleted" -ForegroundColor Green
    }
    catch {
        Write-Host "    WARNING: Could not delete Lambda function $FunctionName (might not exist): $_" -ForegroundColor Yellow
    }
}

# Function to delete CloudWatch Log Groups
function Remove-CloudWatchLogGroup {
    param([string]$LogGroupName, [string]$Region)
    
    if ([string]::IsNullOrEmpty($LogGroupName)) {
        return
    }
    
    Write-Host "  Deleting CloudWatch log group: $LogGroupName" -ForegroundColor Gray
    
    try {
        # Check if log group exists
        $exists = aws logs describe-log-groups --log-group-name-prefix $LogGroupName --region $Region 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty logGroups | Where-Object { $_.logGroupName -eq $LogGroupName }
        
        if ($exists) {
            # Delete the log group
            aws logs delete-log-group --log-group-name $LogGroupName --region $Region 2>$null | Out-Null
            Write-Host "    SUCCESS: Log group $LogGroupName deleted" -ForegroundColor Green
        } else {
            Write-Host "    Log group $LogGroupName does not exist" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "    WARNING: Could not delete log group $LogGroupName (might not exist): $_" -ForegroundColor Yellow
    }
}

# Function to delete IAM roles (after detaching policies)
function Remove-IAMRole {
    param([string]$RoleName)
    
    if ([string]::IsNullOrEmpty($RoleName)) {
        return
    }
    
    Write-Host "  Deleting IAM role: $RoleName" -ForegroundColor Gray
    
    try {
        # List attached policies
        $policies = aws iam list-attached-role-policies --role-name $RoleName 2>$null | ConvertFrom-Json
        if ($policies.AttachedPolicies) {
            foreach ($policy in $policies.AttachedPolicies) {
                aws iam detach-role-policy --role-name $RoleName --policy-arn $policy.PolicyArn 2>$null | Out-Null
                Write-Host "    Detached policy: $($policy.PolicyArn)" -ForegroundColor Gray
            }
        }
        
        # List inline policies
        $inlinePolicies = aws iam list-role-policies --role-name $RoleName 2>$null | ConvertFrom-Json
        if ($inlinePolicies.PolicyNames) {
            foreach ($policyName in $inlinePolicies.PolicyNames) {
                aws iam delete-role-policy --role-name $RoleName --policy-name $policyName 2>$null | Out-Null
                Write-Host "    Deleted inline policy: $policyName" -ForegroundColor Gray
            }
        }
        
        # Delete the role
        aws iam delete-role --role-name $RoleName 2>$null | Out-Null
        
        Write-Host "    SUCCESS: IAM role $RoleName deleted" -ForegroundColor Green
    }
    catch {
        Write-Host "    WARNING: Could not delete IAM role $RoleName (might not exist): $_" -ForegroundColor Yellow
    }
}

# Step 2: Empty S3 buckets (required before destroy due to force_destroy=false)
Write-Host "Step 1: Emptying S3 buckets..." -ForegroundColor Cyan

if (-not [string]::IsNullOrEmpty($bucketName)) {
    Empty-S3Bucket $bucketName $region
}
if (-not [string]::IsNullOrEmpty($cloudtrailBucket)) {
    Empty-S3Bucket $cloudtrailBucket $region
}

Write-Host ""

# Step 3: Run terraform destroy
Write-Host "Step 2: Running Terraform destroy..." -ForegroundColor Cyan
Write-Host "  This will delete: VPC, Lambda functions, API Gateway, Cognito, DynamoDB, KMS, IAM roles..." -ForegroundColor Gray
Write-Host ""

$terraformDestroySuccess = $false
try {
    terraform destroy -auto-approve
    if ($LASTEXITCODE -eq 0) {
        $terraformDestroySuccess = $true
        Write-Host ""
        Write-Host "SUCCESS: Terraform destroy completed!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "WARNING: Terraform destroy had errors. Will attempt manual cleanup..." -ForegroundColor Yellow
    }
}
catch {
    Write-Host ""
    Write-Host "WARNING: Terraform destroy failed. Will attempt manual cleanup..." -ForegroundColor Yellow
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""

# Step 4: Manual cleanup - Delete DynamoDB tables if they still exist
Write-Host "Step 3: Checking and deleting remaining DynamoDB tables..." -ForegroundColor Cyan

# Known DynamoDB tables from the infrastructure
$dynamoDBTables = @(
    "FileVaultUsers",
    "FileVaultFiles",
    "FileVaultAuditLog",
    "FileVaultDeletionAuditLog"
)

foreach ($tableName in $dynamoDBTables) {
    Remove-DynamoDBTable $tableName $region
}

# Also check for any other FileVault-related tables
Write-Host "  Checking for other FileVault DynamoDB tables..." -ForegroundColor Gray
try {
    $allTables = aws dynamodb list-tables --region $region 2>$null | ConvertFrom-Json
    if ($allTables.TableNames) {
        foreach ($table in $allTables.TableNames) {
            if ($table -like "*FileVault*" -or $table -like "*filevault*") {
                if ($dynamoDBTables -notcontains $table) {
                    Write-Host "    Found additional table: $table" -ForegroundColor Yellow
                    Remove-DynamoDBTable $table $region
                }
            }
        }
    }
}
catch {
    Write-Host "    Could not list tables: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Manual cleanup - Delete Lambda functions if they still exist
Write-Host "Step 4: Checking and deleting remaining Lambda functions..." -ForegroundColor Cyan

# Known Lambda functions from the infrastructure
$lambdaFunctions = @(
    "secure-file-upload",
    "secure-file-list",
    "secure-file-download",
    "secure-file-delete",
    "cognito-post-confirmation",
    "filevault-list-users",
    "filevault-update-role",
    "filevault-update-delegate",
    "secure-get-delegated-users",
    "secure-file-admin-delete"
)

foreach ($functionName in $lambdaFunctions) {
    Remove-LambdaFunction $functionName $region
}

# Also check for any other FileVault-related Lambda functions
Write-Host "  Checking for other FileVault Lambda functions..." -ForegroundColor Gray
try {
    $allFunctions = aws lambda list-functions --region $region 2>$null | ConvertFrom-Json
    if ($allFunctions.Functions) {
        foreach ($func in $allFunctions.Functions) {
            $funcName = $func.FunctionName
            if (($funcName -like "*filevault*" -or $funcName -like "*FileVault*" -or $funcName -like "*secure-file*" -or $funcName -like "*cognito-post*") -and ($lambdaFunctions -notcontains $funcName)) {
                Write-Host "    Found additional Lambda function: $funcName" -ForegroundColor Yellow
                Remove-LambdaFunction $funcName $region
            }
        }
    }
}
catch {
    Write-Host "    Could not list Lambda functions: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Delete CloudWatch Log Groups
Write-Host "Step 5: Checking and deleting CloudWatch log groups..." -ForegroundColor Cyan

# Known CloudWatch log groups (one per Lambda function)
$logGroups = @(
    "/aws/lambda/secure-file-upload",
    "/aws/lambda/secure-file-list",
    "/aws/lambda/secure-file-download",
    "/aws/lambda/secure-file-delete",
    "/aws/lambda/cognito-post-confirmation",
    "/aws/lambda/filevault-list-users",
    "/aws/lambda/filevault-update-role",
    "/aws/lambda/filevault-update-delegate",
    "/aws/lambda/secure-get-delegated-users",
    "/aws/lambda/secure-file-admin-delete"
)

foreach ($logGroupName in $logGroups) {
    Remove-CloudWatchLogGroup $logGroupName $region
}

# Also check for any other FileVault-related log groups
Write-Host "  Checking for other FileVault log groups..." -ForegroundColor Gray
try {
    $allLogGroups = aws logs describe-log-groups --region $region 2>$null | ConvertFrom-Json
    if ($allLogGroups.logGroups) {
        foreach ($lg in $allLogGroups.logGroups) {
            $lgName = $lg.logGroupName
            if (($lgName -like "*filevault*" -or $lgName -like "*FileVault*" -or $lgName -like "*secure-file*" -or $lgName -like "*cognito-post*") -and ($logGroups -notcontains $lgName)) {
                Write-Host "    Found additional log group: $lgName" -ForegroundColor Yellow
                Remove-CloudWatchLogGroup $lgName $region
            }
        }
    }
}
catch {
    Write-Host "    Could not list log groups: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Delete IAM roles
Write-Host "Step 6: Checking and deleting IAM roles..." -ForegroundColor Cyan

# Known IAM roles from the infrastructure
$iamRoles = @(
    "secure-file-upload-role",
    "secure-file-list-role",
    "secure-file-download-role",
    "secure-file-delete-role",
    "post-confirmation-lambda-role",
    "filevault-admin-lambdas-role",
    "admin-lambdas-role",
    "secure-file-admin-delete-role",
    "secure-get-delegated-users-role",
    "get-delegated-users-role",
    "cognito-admins-role",
    "cognito-editors-role",
    "cognito-viewers-role",
    "filevault-admin-role",
    "filevault-editor-role",
    "filevault-viewer-role"
)

foreach ($roleName in $iamRoles) {
    Remove-IAMRole $roleName
}

# Also check for any other FileVault-related IAM roles
Write-Host "  Checking for other FileVault IAM roles..." -ForegroundColor Gray
try {
    $allRoles = aws iam list-roles 2>$null | ConvertFrom-Json
    if ($allRoles.Roles) {
        foreach ($role in $allRoles.Roles) {
            $roleName = $role.RoleName
            if (($roleName -like "*filevault*" -or $roleName -like "*FileVault*" -or $roleName -like "*secure-file*" -or $roleName -like "*post-confirmation*") -and ($iamRoles -notcontains $roleName)) {
                Write-Host "    Found additional IAM role: $roleName" -ForegroundColor Yellow
                Remove-IAMRole $roleName
            }
        }
    }
}
catch {
    Write-Host "    Could not list IAM roles: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 7: Delete IAM Policies
Write-Host "Step 7: Checking and deleting IAM policies..." -ForegroundColor Cyan

# Known IAM policies from the infrastructure
$iamPolicies = @(
    "secure-file-admin-delete-policy",
    "secure-get-delegated-users-policy",
    "secure-filevault-audit-logging",
    "filevault-post-confirmation-dynamodb",
    "filevault-admin-user-management"
)

foreach ($policyName in $iamPolicies) {
    Write-Host "  Deleting IAM policy: $policyName" -ForegroundColor Gray
    try {
        # List all versions of the policy
        $policyVersions = aws iam list-policy-versions --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$policyName" 2>$null | ConvertFrom-Json
        if ($policyVersions.Versions) {
            # Delete non-default versions first
            foreach ($version in $policyVersions.Versions) {
                if (-not $version.IsDefaultVersion) {
                    aws iam delete-policy-version --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$policyName" --version-id $version.VersionId 2>$null | Out-Null
                }
            }
            # Delete the policy (this deletes default version too)
            aws iam delete-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$policyName" 2>$null | Out-Null
            Write-Host "    SUCCESS: IAM policy $policyName deleted" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "    WARNING: Could not delete IAM policy $policyName (might not exist): $_" -ForegroundColor Yellow
    }
}

# Also check for any other FileVault-related policies
Write-Host "  Checking for other FileVault IAM policies..." -ForegroundColor Gray
try {
    $allPolicies = aws iam list-policies --scope Local 2>$null | ConvertFrom-Json
    if ($allPolicies.Policies) {
        foreach ($policy in $allPolicies.Policies) {
            $policyName = $policy.PolicyName
            if (($policyName -like "*filevault*" -or $policyName -like "*FileVault*" -or $policyName -like "*secure-file*") -and ($iamPolicies -notcontains $policyName)) {
                Write-Host "    Found additional IAM policy: $policyName" -ForegroundColor Yellow
                try {
                    $policyArn = $policy.Arn
                    # Delete non-default versions first
                    $policyVersions = aws iam list-policy-versions --policy-arn $policyArn 2>$null | ConvertFrom-Json
                    if ($policyVersions.Versions) {
                        foreach ($version in $policyVersions.Versions) {
                            if (-not $version.IsDefaultVersion) {
                                aws iam delete-policy-version --policy-arn $policyArn --version-id $version.VersionId 2>$null | Out-Null
                            }
                        }
                    }
                    aws iam delete-policy --policy-arn $policyArn 2>$null | Out-Null
                    Write-Host "      Deleted: $policyName" -ForegroundColor Green
                }
                catch {
                    Write-Host "      Could not delete: $policyName" -ForegroundColor Yellow
                }
            }
        }
    }
}
catch {
    Write-Host "    Could not list IAM policies: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 8: Delete CloudTrail
Write-Host "Step 8: Checking and deleting CloudTrail..." -ForegroundColor Cyan

$cloudtrailName = "filevault-trail"
Write-Host "  Deleting CloudTrail: $cloudtrailName" -ForegroundColor Gray

try {
    # Stop logging first
    aws cloudtrail stop-logging --name $cloudtrailName 2>$null | Out-Null
    Start-Sleep -Seconds 2
    
    # Delete the trail
    aws cloudtrail delete-trail --name $cloudtrailName 2>$null | Out-Null
    Write-Host "    SUCCESS: CloudTrail $cloudtrailName deleted" -ForegroundColor Green
}
catch {
    Write-Host "    WARNING: Could not delete CloudTrail $cloudtrailName (might not exist): $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 9: Check for bucket in wrong region (filevault-dev)
Write-Host "Step 9: Checking for bucket 'filevault-dev' in other regions..." -ForegroundColor Cyan

$regions = @("eu-central-1", "eu-west-1", "us-west-2")
foreach ($checkRegion in $regions) {
    Write-Host "  Checking region: $checkRegion" -ForegroundColor Gray
    try {
        aws s3api head-bucket --bucket "filevault-dev" --region $checkRegion 2>$null | Out-Null
        Write-Host "    Found bucket 'filevault-dev' in $checkRegion" -ForegroundColor Yellow
        Write-Host "    Attempting to empty and delete..." -ForegroundColor Yellow
        
        # Empty bucket
        Empty-S3Bucket "filevault-dev" $checkRegion
        
        # Delete bucket
        aws s3api delete-bucket --bucket "filevault-dev" --region $checkRegion 2>$null | Out-Null
        Write-Host "    SUCCESS: Deleted bucket 'filevault-dev' from $checkRegion" -ForegroundColor Green
    }
    catch {
        # Bucket doesn't exist in this region, continue
    }
}

Write-Host ""

# Step 10: Final status
if ($terraformDestroySuccess) {
    Write-Host "SUCCESS: Infrastructure successfully destroyed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: If you have a Terraform state backend (S3 + DynamoDB), you may need to manually delete:" -ForegroundColor Yellow
    Write-Host "  - filevault-tfstate-new S3 bucket" -ForegroundColor Yellow
    Write-Host "  - filevault-lock DynamoDB table" -ForegroundColor Yellow
} else {
    Write-Host "WARNING: Terraform destroy had issues. Manual cleanup attempted." -ForegroundColor Yellow
    Write-Host "Please verify all resources are deleted manually if needed." -ForegroundColor Yellow
}

Pop-Location

Write-Host ""
Write-Host "Destroy script complete!" -ForegroundColor Cyan