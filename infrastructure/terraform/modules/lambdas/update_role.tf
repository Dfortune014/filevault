#############################################
# Secure File Vault - Update Role Lambda (Admin)
#############################################

resource "aws_lambda_function" "update_role" {
  function_name    = "filevault-update-role"
  runtime          = "python3.11"
  role             = aws_iam_role.admin_lambdas_role.arn
  handler          = "main.lambda_handler"

  filename         = "${path.module}/update-role.zip"
  source_code_hash = filebase64sha256("${path.module}/update-role/main.py")

  environment {
    variables = {
      USERS_TABLE            = var.users_table_name
      USER_POOL_ID           = var.user_pool_id
      UPDATE_DELEGATE_LAMBDA = aws_lambda_function.update_delegate.function_name
      GENERAL_AUDIT_TABLE    = var.general_audit_table_name
    }
  }
}

# Attach shared audit logging policy (if not already attached to admin_lambdas_role)
resource "aws_iam_role_policy_attachment" "audit_logging_admin_update_role" {
  role       = aws_iam_role.admin_lambdas_role.name
  policy_arn = aws_iam_policy.audit_logging_policy.arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "allow_apigw_update_role" {
  statement_id  = "AllowAPIGatewayInvokeUpdateRole"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_role.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}

output "update_role_lambda_arn" {
  description = "ARN of the filevault-update-role Lambda function"
  value       = aws_lambda_function.update_role.arn
}
