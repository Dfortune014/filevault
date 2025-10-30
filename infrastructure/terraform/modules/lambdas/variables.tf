#############################################
# Secure File Vault - Shared Lambda Variables
#############################################

# ───────────────────────────────────────────
# Core AWS Context
# ───────────────────────────────────────────
variable "bucket_name" {
  description = "Name of the S3 bucket used for file storage"
  type        = string
}

variable "kms_key_id" {
  description = "KMS Key ID used for server-side encryption"
  type        = string
}

variable "region" {
  description = "AWS region for all Lambda resources"
  type        = string
}

variable "account_id" {
  description = "AWS Account ID"
  type        = string
}

# ───────────────────────────────────────────
# Cognito Configuration
# ───────────────────────────────────────────
variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}

# ───────────────────────────────────────────
# API Gateway Configuration
# ───────────────────────────────────────────
variable "api_id" {
  description = "API Gateway ID"
  type        = string
  default     = null
}

variable "api_execution_arn" {
  description = "Execution ARN of the API Gateway"
  type        = string
  default     = null
}

# ───────────────────────────────────────────
# DynamoDB Tables (Users & Files)
# ───────────────────────────────────────────
variable "users_table_name" {
  description = "Name of the DynamoDB FileVaultUsers table"
  type        = string
}

variable "users_table_arn" {
  description = "ARN of the DynamoDB FileVaultUsers table"
  type        = string
}

variable "files_table_name" {
  description = "Name of the DynamoDB FileVaultFiles table"
  type        = string
}

variable "files_table_arn" {
  description = "ARN of the DynamoDB FileVaultFiles table"
  type        = string
}

# ───────────────────────────────────────────
# Audit Logging Tables (General + Deletion)
# ───────────────────────────────────────────
variable "general_audit_table_name" {
  description = "Name of the general FileVaultAuditLog table for standard operations"
  type        = string
}

variable "general_audit_table_arn" {
  description = "ARN of the general FileVaultAuditLog table"
  type        = string
}

variable "deletion_audit_table_name" {
  description = "Name of the FileVaultDeletionAuditLog table for admin deletion compliance"
  type        = string
}

variable "deletion_audit_table_arn" {
  description = "ARN of the FileVaultDeletionAuditLog table"
  type        = string
}
