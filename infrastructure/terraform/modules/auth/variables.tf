variable "user_pool_name" {
  type        = string
  description = "Name of the Cognito User Pool"
  default     = "filevault-pool"
}

variable "password_min_length" {
  type        = number
  description = "Minimum password length for Cognito users"
  default     = 10
}

variable "mfa_configuration" {
  type        = string
  description = "MFA setting for the Cognito User Pool (OFF, ON, OPTIONAL)"
  default     = "OFF"
}

variable "post_confirmation_lambda_arn" {
  description = "ARN of the PostConfirmation Lambda"
  type        = string
  default     = null
}
