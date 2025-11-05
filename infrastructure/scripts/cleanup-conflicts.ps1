# PowerShell script to clean up conflicting resources before Terraform apply
# This fixes IAM roles, policies, CloudTrail, and S3 bucket conflicts

$ErrorActionPreference = "Stop"
$region = "us-east-1"

Write-Host "=== Cleaning up conflicting resources ===" -ForegroundColor Cyan
Write-Host ""

# Function to delete IAM roles
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
            }
        }
        
        # List inline policies
        $inlinePolicies = aws iam list-role-policies --role-name $RoleName 2>$null | ConvertFrom-Json
        if ($inlinePolicies.PolicyNames) {
            foreach ($policyName in $inlinePolicies.PolicyNames) {
                aws iam delete-role-policy --role-name $RoleName --policy-name $policyName 2>$null | Out-Null
            }
        }
        
        # Delete the role
        aws iam delete-role --role-name $RoleName 2>$null | Out-Null
        Write-Host "    SUCCESS: IAM role $RoleName deleted" -ForegroundColor Green
    }
    catch {
        Write-Host "    WARNING: Could not delete IAM role $RoleName`: $_" -ForegroundColor Yellow
    }
}

# Function to delete IAM policies
function Remove-IAMPolicy {
    param([string]$PolicyName)
    
    Write-Host "  Deleting IAM policy: $PolicyName" -ForegroundColor Gray
    
    try {
        $accountId = aws sts get-caller-identity --query Account --output text
        $policyArn = "arn:aws:iam::${accountId}:policy/$PolicyName"
        
        # List all versions
        $policyVersions = aws iam list-policy-versions --policy-arn $policyArn 2>$null | ConvertFrom-Json
        if ($policyVersions.Versions) {
            # Delete non-default versions first
            foreach ($version in $policyVersions.Versions) {
                if (-not $version.IsDefaultVersion) {
                    aws iam delete-policy-version --policy-arn $policyArn --version-id $version.VersionId 2>$null | Out-Null
                }
            }
        }
        
        # Delete the policy
        aws iam delete-policy --policy-arn $policyArn 2>$null | Out-Null
        Write-Host "    SUCCESS: IAM policy $PolicyName deleted" -ForegroundColor Green
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Host "    WARNING: Could not delete IAM policy $PolicyName`: $errorMsg" -ForegroundColor Yellow
    }
}

# 1. Delete Cognito IAM Roles
Write-Host "Step 1: Deleting Cognito IAM roles..." -ForegroundColor Cyan
$cognitoRoles = @(
    "cognito-admins-role",
    "cognito-editors-role",
    "cognito-viewers-role"
)
foreach ($role in $cognitoRoles) {
    Remove-IAMRole $role
}

Write-Host ""

# 2. Delete IAM Policies
Write-Host "Step 2: Deleting IAM policies..." -ForegroundColor Cyan
$policies = @(
    "secure-file-admin-delete-policy",
    "secure-get-delegated-users-policy",
    "secure-filevault-audit-logging",
    "filevault-post-confirmation-dynamodb",
    "filevault-admin-user-management"
)
foreach ($policy in $policies) {
    Remove-IAMPolicy $policy
}

Write-Host ""

# 3. Delete CloudTrail
Write-Host "Step 3: Deleting CloudTrail..." -ForegroundColor Cyan
try {
    aws cloudtrail stop-logging --name "filevault-trail" 2>$null | Out-Null
    Start-Sleep -Seconds 2
    aws cloudtrail delete-trail --name "filevault-trail" 2>$null | Out-Null
    Write-Host "  SUCCESS: CloudTrail deleted" -ForegroundColor Green
}
catch {
    Write-Host "  WARNING: Could not delete CloudTrail: $_" -ForegroundColor Yellow
}

Write-Host ""

# 4. Check for filevault-dev bucket in other regions
Write-Host "Step 4: Checking for 'filevault-dev' bucket in other regions..." -ForegroundColor Cyan
$regions = @("eu-central-1", "eu-west-1", "us-west-2")
foreach ($checkRegion in $regions) {
    try {
        aws s3api head-bucket --bucket "filevault-dev" --region $checkRegion 2>$null | Out-Null
        Write-Host "  Found 'filevault-dev' in $checkRegion - attempting to delete..." -ForegroundColor Yellow
        
        # Empty bucket
        Write-Host "    Emptying bucket..." -ForegroundColor Gray
        $versions = aws s3api list-object-versions --bucket "filevault-dev" --region $checkRegion 2>$null | ConvertFrom-Json
        if ($versions.Versions) {
            foreach ($version in $versions.Versions) {
                aws s3api delete-object --bucket "filevault-dev" --key $version.Key --version-id $version.VersionId --region $checkRegion 2>$null | Out-Null
            }
        }
        if ($versions.DeleteMarkers) {
            foreach ($marker in $versions.DeleteMarkers) {
                aws s3api delete-object --bucket "filevault-dev" --key $marker.Key --version-id $marker.VersionId --region $checkRegion 2>$null | Out-Null
            }
        }
        aws s3 rm "s3://filevault-dev" --recursive --region $checkRegion 2>$null | Out-Null
        
        # Delete bucket
        aws s3api delete-bucket --bucket "filevault-dev" --region $checkRegion 2>$null | Out-Null
        Write-Host "    SUCCESS: Deleted bucket from $checkRegion" -ForegroundColor Green
    }
    catch {
        # Bucket doesn't exist, continue
    }
}

Write-Host ""
Write-Host "=== Cleanup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run: terraform apply" -ForegroundColor Cyan
