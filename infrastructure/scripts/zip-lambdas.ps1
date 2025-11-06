# PowerShell script to zip Lambda functions for Terraform deployment

$ErrorActionPreference = "Stop"

Write-Host "Zipping Lambda functions..." -ForegroundColor Cyan

$root = Join-Path $PSScriptRoot "..\terraform\modules\lambdas"

# Map folder names to zip file names (handles hyphens vs underscores)
$lambdaMapping = @{
    "admin_delete"        = "admin_delete"
    "check_mfa_status"    = "check_mfa_status"
    "delete"              = "delete"
    "download"            = "download"
    "get_delegated_users" = "get_delegated_users"
    "list"                = "list"
    "post-confirmation"   = "post_confirmation"
    "update_delegate"     = "update_delegate"
    "update-role"         = "update_role"
    "upload"              = "upload"
    "users"               = "users"
}

foreach ($folder in $lambdaMapping.Keys) {
    $zipName = $lambdaMapping[$folder]
    $mainPy = Join-Path $root "$folder\main.py"
    $zipFile = Join-Path $root "$zipName.zip"
    
    if (Test-Path $mainPy) {
        # Remove old zip if it exists
        if (Test-Path $zipFile) {
            Remove-Item $zipFile -Force
        }
        
        # Create zip with only main.py
        Compress-Archive -Path $mainPy -DestinationPath $zipFile -CompressionLevel Optimal
        Write-Host "Zipped $folder -> $zipName.zip" -ForegroundColor Green
    } else {
        Write-Host "WARNING: $mainPy not found, skipping..." -ForegroundColor Yellow
    }
}

Write-Host "All Lambda zips created." -ForegroundColor Green