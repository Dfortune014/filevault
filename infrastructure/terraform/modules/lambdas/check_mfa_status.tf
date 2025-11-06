#############################################
# Secure File Vault - Check MFA Status Lambda
#############################################

# ───────────────────────────────────────────
# IAM Role for Check MFA Status Lambda
# ───────────────────────────────────────────
resource "aws_iam_role" "check_mfa_status_role" {
  name = "filevault-check-mfa-status-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

# ───────────────────────────────────────────
# Attach Basic Logging Policy
# ───────────────────────────────────────────
resource "aws_iam_role_policy_attachment" "check_mfa_status_logs" {
  role       = aws_iam_role.check_mfa_status_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ───────────────────────────────────────────
# Cognito Admin API Access Policy
# ───────────────────────────────────────────
resource "aws_iam_role_policy" "check_mfa_status_cognito" {
  name = "filevault-check-mfa-status-cognito"
  role = aws_iam_role.check_mfa_status_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "cognito-idp:AdminListUserMfaDevices",
          "cognito-idp:AdminGetUser"
        ],
        Resource = var.user_pool_arn
      }
    ]
  })
}

# ───────────────────────────────────────────
# Lambda Function Definition
# ───────────────────────────────────────────
resource "aws_lambda_function" "check_mfa_status" {
  function_name = "filevault-check-mfa-status"
  runtime       = "python3.11"
  role          = aws_iam_role.check_mfa_status_role.arn
  handler       = "main.lambda_handler"

  filename         = "${path.module}/check_mfa_status.zip"
  source_code_hash = filebase64sha256("${path.module}/check_mfa_status/main.py")

  environment {
    variables = {
      USER_POOL_ID = var.user_pool_id
    }
  }
}

# ───────────────────────────────────────────
# Lambda Permission for API Gateway Invocation
# ───────────────────────────────────────────
resource "aws_lambda_permission" "allow_apigw_check_mfa_status" {
  statement_id  = "AllowAPIGatewayInvokeCheckMfaStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.check_mfa_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}

# ───────────────────────────────────────────
# Output (ARN for API Gateway Integration)
# ───────────────────────────────────────────
output "check_mfa_status_lambda_arn" {
  description = "ARN of the filevault-check-mfa-status Lambda function"
  value       = aws_lambda_function.check_mfa_status.arn
}

