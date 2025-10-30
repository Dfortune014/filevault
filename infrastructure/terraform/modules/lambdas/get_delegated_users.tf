#############################################
# Secure File Vault - Get Delegated Users Lambda (Editor)
#############################################

# ───────────────────────────────────────────
# IAM Role (Dedicated for this Lambda)
# ───────────────────────────────────────────
resource "aws_iam_role" "get_delegated_users_role" {
  name = "secure-get-delegated-users-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

# --- Logging for CloudWatch ---
resource "aws_iam_role_policy_attachment" "get_delegated_users_logging" {
  role       = aws_iam_role.get_delegated_users_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# --- DynamoDB Query Permissions (Least Privilege) ---
resource "aws_iam_policy" "get_delegated_users_policy" {
  name = "secure-get-delegated-users-policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowQueryDelegatedUsers",
        Effect = "Allow",
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem"
        ],
        Resource = [
          "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.users_table_name}",
          "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.users_table_name}/index/delegatedEditor-index"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "get_delegated_users_attach" {
  role       = aws_iam_role.get_delegated_users_role.name
  policy_arn = aws_iam_policy.get_delegated_users_policy.arn
}

# ───────────────────────────────────────────
# CloudWatch Log Group
# ───────────────────────────────────────────
resource "aws_cloudwatch_log_group" "get_delegated_users_log_group" {
  name              = "/aws/lambda/secure-get-delegated-users"
  retention_in_days = 14

  tags = {
    Project  = "SecureFileVault"
    Function = "GetDelegatedUsers"
  }
}

# ───────────────────────────────────────────
# Lambda Function Definition
# ───────────────────────────────────────────
resource "aws_lambda_function" "get_delegated_users" {
  function_name    = "secure-get-delegated-users"
  runtime          = "python3.11"
  handler          = "main.handler"
  role             = aws_iam_role.get_delegated_users_role.arn

  filename         = "${path.module}/get_delegated_users.zip"
  source_code_hash = filebase64sha256("${path.module}/get_delegated_users/main.py")

  environment {
    variables = {
      USERS_TABLE = var.users_table_name
    }
  }

  timeout     = 10
  memory_size = 256

  tags = {
    Project  = "SecureFileVault"
    Function = "GetDelegatedUsers"
    Access   = "EditorOnly"
  }

  depends_on = [aws_cloudwatch_log_group.get_delegated_users_log_group]
}

# ───────────────────────────────────────────
# Lambda Permission for API Gateway Invocation
# ───────────────────────────────────────────
resource "aws_lambda_permission" "get_delegated_users_apigw" {
  statement_id  = "AllowAPIGatewayInvokeGetDelegatedUsers"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_delegated_users.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}

# ───────────────────────────────────────────
# Output (ARN for API Gateway Integration)
# ───────────────────────────────────────────
output "get_delegated_users_lambda_arn" {
  description = "ARN of the secure-get-delegated-users Lambda function"
  value       = aws_lambda_function.get_delegated_users.arn
}
