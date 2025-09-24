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

