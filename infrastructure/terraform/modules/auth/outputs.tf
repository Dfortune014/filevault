output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.this.id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.this.arn
}

output "admin_role_arn" {
  value       = aws_iam_role.admins.arn
  description = "IAM role for Admin group"
}

output "editor_role_arn" {
  value       = aws_iam_role.editors.arn
  description = "IAM role for Editor group"
}

output "viewer_role_arn" {
  value       = aws_iam_role.viewers.arn
  description = "IAM role for Viewer group"
}

output "identity_pool_id" {
  description = "The ID of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.this.id
}

output "identity_pool_name" {
  description = "The name of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.this.identity_pool_name
}

output "identity_pool_arn" {
  description = "ARN of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.this.arn
}
