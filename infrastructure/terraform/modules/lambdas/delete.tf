#############################################
# Secure File Vault - Delete Lambda
#############################################

resource "aws_iam_role" "delete_role" {
  name = "secure-file-delete-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "delete_logging" {
  role       = aws_iam_role.delete_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "delete_policy" {
  name = "secure-file-delete-policy"
  role = aws_iam_role.delete_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:DeleteObject",
          "s3:GetObject"
        ],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Resource = [
          "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.files_table_name}",
          "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.users_table_name}"
        ]
      }
    ]
  })
}

# Attach shared audit logging policy
resource "aws_iam_role_policy_attachment" "delete_audit_logging" {
  role       = aws_iam_role.delete_role.name
  policy_arn = aws_iam_policy.audit_logging_policy.arn
}

resource "aws_lambda_function" "delete" {
  function_name    = "secure-file-delete"
  runtime          = "python3.11"
  role             = aws_iam_role.delete_role.arn
  handler          = "main.handler"

  filename         = "${path.module}/delete.zip"
  source_code_hash = filebase64sha256("${path.module}/delete/main.py")

  environment {
    variables = {
      BUCKET_NAME          = var.bucket_name
      FILES_TABLE          = var.files_table_name
      USERS_TABLE          = var.users_table_name
      GENERAL_AUDIT_TABLE  = var.general_audit_table_name
      DELETION_AUDIT_TABLE = var.deletion_audit_table_name
    }
  }
}

resource "aws_lambda_permission" "allow_apigw_delete" {
  statement_id  = "AllowAPIGatewayInvokeDelete"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.delete.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*/api/files/*"
}

output "delete_lambda_arn" {
  description = "ARN of the secure-file-delete Lambda function"
  value       = aws_lambda_function.delete.arn
}
