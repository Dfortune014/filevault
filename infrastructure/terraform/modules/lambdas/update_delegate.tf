#############################################
# Secure File Vault - Update Delegate Lambda (Admin)
#############################################

resource "aws_lambda_function" "update_delegate" {
  function_name    = "filevault-update-delegate"
  runtime          = "python3.11"
  role             = aws_iam_role.admin_lambdas_role.arn
  handler          = "main.lambda_handler"

  filename         = "${path.module}/update_delegate.zip"
  source_code_hash = filebase64sha256("${path.module}/update_delegate/main.py")

  environment {
    variables = {
      USERS_TABLE         = var.users_table_name
      GENERAL_AUDIT_TABLE = var.general_audit_table_name
    }
  }
}

# Attach shared audit logging policy
resource "aws_iam_role_policy_attachment" "audit_logging_admin_update_delegate" {
  role       = aws_iam_role.admin_lambdas_role.name
  policy_arn = aws_iam_policy.audit_logging_policy.arn
}

# Lambda Permission for API Gateway Invocation
resource "aws_lambda_permission" "allow_apigw_update_delegate" {
  statement_id  = "AllowAPIGatewayInvokeUpdateDelegate"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_delegate.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}

output "update_delegate_lambda_arn" {
  description = "ARN of the filevault-update-delegate Lambda function"
  value       = aws_lambda_function.update_delegate.arn
}
