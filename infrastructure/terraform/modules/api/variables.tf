variable "upload_lambda_arn" {}
variable "list_lambda_arn" {}
variable "download_lambda_arn" {}
variable "delete_lambda_arn" {}


variable "region" {
  type        = string
  description = "AWS region for API Gateway"
}

variable "user_pool_id" {
  type        = string
  description = "Cognito User Pool ID"
}

variable "user_pool_client_id" {
  type        = string
  description = "Cognito User Pool Client ID"
}

variable "list_users_lambda_arn" {
  type        = string
  description = "ARN of the List Users Lambda function"
}
variable "update_role_lambda_arn" {
  description = "ARN of the Lambda function that updates user roles"
  type        = string
}

variable "update_delegate_lambda_arn" {
  description = "ARN of the Lambda function that assigns viewers to editors"
  type        = string
}

variable "get_delegated_users_lambda_arn" {
  description = "ARN of the Lambda function for retrieving delegated users"
  type        = string
}

variable "admin_delete_lambda_arn" {
  description = "ARN of the secure-file-admin-delete Lambda function"
}
variable "allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = ["*"]  
}