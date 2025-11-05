# Fix Terraform State - Delete Checksum Entry
Write-Host "Deleting checksum entry from DynamoDB..." -ForegroundColor Cyan

# Method using here-string (most reliable)
$keyJson = @"
{"LockID": {"S": "filevault-tfstate-new/terraform/state.tfstate-md5"}}
"@

aws dynamodb delete-item --table-name filevault-lock --key $keyJson --region us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Checksum entry deleted!" -ForegroundColor Green
    
    # Verify it's gone
    Write-Host "`nVerifying..." -ForegroundColor Yellow
    $remaining = aws dynamodb scan --table-name filevault-lock --region us-east-1 | ConvertFrom-Json
    if ($remaining.Items -and $remaining.Items.Count -gt 0) {
        Write-Host "WARNING: Still has items in table" -ForegroundColor Yellow
    } else {
        Write-Host "Table is now empty - SUCCESS!" -ForegroundColor Green
    }
} else {
    Write-Host "ERROR: Failed to delete entry" -ForegroundColor Red
}

Write-Host "`nNow run: terraform init -reconfigure" -ForegroundColor Cyan