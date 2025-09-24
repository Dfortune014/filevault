# =====================
# Security (storage bucket + KMS)
# =====================
output "bucket_name" {
  description = "Name of the filevault S3 bucket"
  value       = module.storage.bucket_name
}

output "bucket_arn" {
  description = "ARN of the filevault S3 bucket"
  value       = module.storage.bucket_arn
}

output "kms_key_id" {
  description = "KMS key ID used for encryption"
  value       = module.storage.kms_key_id
}

# =====================
# Storage / Logging
# =====================
output "cloudtrail_bucket" {
  description = "S3 bucket name for CloudTrail logs"
  value       = module.security.cloudtrail_bucket
}

# =====================
# Networking
# =====================
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "public_subnet_id" {
  description = "Public subnet ID"
  value       = module.networking.public_subnet_id
}

output "private_subnet_id" {
  description = "Private subnet ID"
  value       = module.networking.private_subnet_id
}

# =====================
# Authentication (Cognito)
# =====================
output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = module.auth.user_pool_id
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = module.auth.user_pool_client_id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = module.auth.user_pool_arn
}

# =====================
# Authentication Groups & IAM roles
# =====================
output "admin_role_arn" {
  description = "IAM role for Admin group"
  value       = module.auth.admin_role_arn
}

output "editor_role_arn" {
  description = "IAM role for Editor group"
  value       = module.auth.editor_role_arn
}

output "viewer_role_arn" {
  description = "IAM role for Viewer group"
  value       = module.auth.viewer_role_arn
}

output "identity_pool_id" {
  description = "The ID of the Cognito Identity Pool"
  value       = module.auth.identity_pool_id
}

output "identity_pool_name" {
  description = "The name of the Cognito Identity Pool"
  value       = module.auth.identity_pool_name
}

output "identity_pool_arn" {
  description = "ARN of the Cognito Identity Pool"
  value       = module.auth.identity_pool_arn
}

# =====================
# API
# =====================
output "api_id" {
  description = "API Gateway ID"
  value       = module.api.api_id
}

output "api_endpoint" {
  description = "Base URL of the API Gateway"
  value       = module.api.api_endpoint
}

output "api_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = module.api.execution_arn
}
