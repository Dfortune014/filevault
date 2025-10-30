output "bucket_name" {
  value = aws_s3_bucket.filevault.bucket
}

output "kms_key_id" {
  value = aws_kms_key.filevault.id
}

output "bucket_arn" {
  description = "ARN of the filevault S3 bucket"
  value       = aws_s3_bucket.filevault.arn
}

output "filevault_users_name" {
  description = "DynamoDB table name for FileVaultUsers"
  value       = aws_dynamodb_table.filevault_users.name
}

output "filevault_users_arn" {
  description = "DynamoDB table ARN for FileVaultUsers"
  value       = aws_dynamodb_table.filevault_users.arn
}

