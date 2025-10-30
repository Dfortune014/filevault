#############################################
# Secure File Vault - List Lambda
#############################################

resource "aws_iam_role" "list_role" {
  name = "secure-file-list-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "list_logging" {
  role       = aws_iam_role.list_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "list_policy" {
  role = aws_iam_role.list_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["s3:ListBucket"],
        Resource = "arn:aws:s3:::${var.bucket_name}"
      },
      {
        Effect = "Allow",
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:BatchGetItem"
        ],
        Resource = [
          var.files_table_arn,
          var.users_table_arn,
          "${var.files_table_arn}/index/*",
          "${var.users_table_arn}/index/*"
        ]
      }
    ]
  })
}

# ✅ Attach shared audit logging policy
resource "aws_iam_role_policy_attachment" "list_audit_logging" {
  role       = aws_iam_role.list_role.name
  policy_arn = aws_iam_policy.audit_logging_policy.arn
}

resource "aws_lambda_function" "list" {
  function_name    = "secure-file-list"
  runtime          = "python3.11"
  role             = aws_iam_role.list_role.arn
  handler          = "main.handler"

  filename         = "${path.module}/list.zip"
  source_code_hash = filebase64sha256("${path.module}/list/main.py")

  environment {
    variables = {
      BUCKET_NAME         = var.bucket_name
      FILES_TABLE         = var.files_table_name
      USERS_TABLE         = var.users_table_name
      GENERAL_AUDIT_TABLE = var.general_audit_table_name
    }
  }
}

resource "aws_lambda_permission" "allow_apigw_list" {
  statement_id  = "AllowAPIGatewayInvokeList"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*/api/files"
}

output "list_lambda_arn" {
  description = "ARN of the secure-file-list Lambda function"
  value       = aws_lambda_function.list.arn
}
