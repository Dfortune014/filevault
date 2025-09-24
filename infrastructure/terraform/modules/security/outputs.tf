output "admin_role_arn" {
  description = "ARN of the admin IAM role"
  value       = aws_iam_role.admin_role.arn
}

output "editor_role_arn" {
  description = "ARN of the editor IAM role"
  value       = aws_iam_role.editor_role.arn
}

output "viewer_role_arn" {
  description = "ARN of the viewer IAM role"
  value       = aws_iam_role.viewer_role.arn
}

output "cloudtrail_bucket" {
  description = "S3 bucket name for CloudTrail logs"
  value       = aws_s3_bucket.cloudtrail_logs.bucket
}

output "cloudtrail_id" {
  description = "ID of the CloudTrail trail"
  value       = aws_cloudtrail.main.id
}

