#############################################
# Secure File Vault - Admin Delete Lambda
#############################################

# ───────────────────────────────────────────
# IAM Role for Admin Delete
# ───────────────────────────────────────────
resource "aws_iam_role" "admin_delete_role" {
  name = "secure-file-admin-delete-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

# Basic Lambda logging
resource "aws_iam_role_policy_attachment" "admin_delete_logging" {
  role       = aws_iam_role.admin_delete_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ───────────────────────────────────────────
# Custom Inline Policy – S3 Delete + DynamoDB
# ───────────────────────────────────────────
resource "aws_iam_policy" "admin_delete_policy" {
  name = "secure-file-admin-delete-policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowDeleteS3Files",
        Effect = "Allow",
        Action = [
          "s3:DeleteObject"
        ],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Sid    = "AllowFileTableAccess",
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem"
        ],
        Resource = var.files_table_arn
      },
      {
        Sid    = "AllowAuditLogging",
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem"
        ],
        Resource = var.deletion_audit_table_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "admin_delete_attach" {
  role       = aws_iam_role.admin_delete_role.name
  policy_arn = aws_iam_policy.admin_delete_policy.arn
}

# ───────────────────────────────────────────
# Lambda Function Definition
# ───────────────────────────────────────────
resource "aws_lambda_function" "admin_delete" {
  function_name    = "secure-file-admin-delete"
  runtime          = "python3.11"
  handler          = "main.handler"
  role             = aws_iam_role.admin_delete_role.arn

  filename         = "${path.module}/admin_delete.zip"
  source_code_hash = filebase64sha256("${path.module}/admin_delete/main.py")

  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
      FILES_TABLE = var.files_table_name
      AUDIT_TABLE = var.deletion_audit_table_name
    }
  }

  timeout     = 15
  memory_size = 256

  tags = {
    Project  = "SecureFileVault"
    Function = "AdminDelete"
  }
}

# ───────────────────────────────────────────
# CloudWatch Log Group
# ───────────────────────────────────────────
resource "aws_cloudwatch_log_group" "admin_delete_logs" {
  name              = "/aws/lambda/secure-file-admin-delete"
  retention_in_days = 14

  tags = {
    Project = "SecureFileVault"
  }
}

# ───────────────────────────────────────────
# Lambda Permission for API Gateway
# ───────────────────────────────────────────
resource "aws_lambda_permission" "admin_delete_apigw" {
  statement_id  = "AllowAPIGatewayInvokeAdminDelete"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin_delete.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}

# ───────────────────────────────────────────
# Output (ARN for API Gateway Integration)
# ───────────────────────────────────────────
output "admin_delete_lambda_arn" {
  description = "ARN of the secure-file-admin-delete Lambda function"
  value       = aws_lambda_function.admin_delete.arn
}

