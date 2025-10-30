variable "project_name" {
  description = "Project name prefix for IAM roles, policies, and CloudTrail"
  type        = string
}

variable "env" {
  description = "Environment name"
  type        = string
  default     = "dev"
}


variable "admin_actions" {
  description = "List of IAM actions allowed for admin role"
  type        = list(string)
  default     = ["s3:*", "kms:*"]
}

variable "editor_actions" {
  description = "List of IAM actions allowed for editor role"
  type        = list(string)
  default     = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
}

variable "viewer_actions" {
  description = "List of IAM actions allowed for viewer role"
  type        = list(string)
  default     = ["s3:GetObject"]
}

variable "bucket_arn" {
  description = "ARN of the S3 bucket used for IAM policies"
  type        = string
}
