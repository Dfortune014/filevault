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
