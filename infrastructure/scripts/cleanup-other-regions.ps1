# Cleanup S3 Buckets in eu-west-1 and eu-central-1
# Run with caution - this will DELETE buckets!

param(
    [switch]$DryRun = $true  # Set to $false to actually delete
)

$regions = @("eu-west-1", "eu-central-1")

foreach ($region in $regions) {
    Write-Host "`n=== Checking region: $region ===" -ForegroundColor Cyan
    
    # List all buckets in this region
    Write-Host "Listing S3 buckets in $region..." -ForegroundColor Yellow
    $buckets = aws s3 ls --region $region 2>$null | ForEach-Object {
        ($_ -split '\s+')[2]
    }
    
    if ($buckets) {
        foreach ($bucket in $buckets) {
            Write-Host "`nFound bucket: $bucket" -ForegroundColor Yellow
            
            if ($DryRun) {
                Write-Host "  [DRY RUN] Would delete: s3://$bucket" -ForegroundColor Green
                
                # Check if bucket contains filevault
                if ($bucket -like "*filevault*") {
                    Write-Host "  ⚠️  This is a FileVault bucket!" -ForegroundColor Red
                }
            } else {
                Write-Host "  Deleting bucket: s3://$bucket" -ForegroundColor Red
                
                # Empty the bucket first
                Write-Host "    Emptying bucket..." -ForegroundColor Yellow
                aws s3 rm "s3://$bucket" --recursive --region $region 2>$null
                
                # Delete all object versions
                Write-Host "    Deleting versions..." -ForegroundColor Yellow
                $versions = aws s3api list-object-versions --bucket $bucket --region $region --query 'Versions[].{Key:Key,VersionId:VersionId}' --output json 2>$null | ConvertFrom-Json
                if ($versions) {
                    $versions | ForEach-Object {
                        aws s3api delete-object --bucket $bucket --key $_.Key --version-id $_.VersionId --region $region --quiet 2>$null
                    }
                }
                
                # Delete all delete markers
                Write-Host "    Deleting delete markers..." -ForegroundColor Yellow
                $deleteMarkers = aws s3api list-object-versions --bucket $bucket --region $region --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output json 2>$null | ConvertFrom-Json
                if ($deleteMarkers) {
                    $deleteMarkers | ForEach-Object {
                        aws s3api delete-object --bucket $bucket --key $_.Key --version-id $_.VersionId --region $region --quiet 2>$null
                    }
                }
                
                # Delete the bucket
                Write-Host "    Deleting bucket..." -ForegroundColor Yellow
                aws s3api delete-bucket --bucket $bucket --region $region
                
                Write-Host "    ✅ Deleted: s3://$bucket" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  No buckets found in $region" -ForegroundColor Green
    }
}

if ($DryRun) {
    Write-Host "`n⚠️  This was a DRY RUN. To actually delete, run:" -ForegroundColor Yellow
    Write-Host "   .\cleanup-other-regions.ps1 -DryRun:`$false" -ForegroundColor Cyan
}