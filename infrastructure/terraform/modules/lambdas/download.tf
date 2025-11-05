#############################################
# Secure File Vault - Download Lambda
#############################################

resource "aws_iam_role" "download_role" {
  name = "secure-file-download-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "download_logging" {
  role       = aws_iam_role.download_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "download_policy" {
  role = aws_iam_role.download_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:ListBucket"],
        Resource = "arn:aws:s3:::${var.bucket_name}"
      },
      {
        Effect   = "Allow",
        Action   = ["s3:GetObject"],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Effect   = "Allow",
        Action   = ["kms:Decrypt"],
        Resource = "arn:aws:kms:${var.region}:${var.account_id}:key/${var.kms_key_id}"
      },
      {
        Effect = "Allow",
        Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan"],
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
resource "aws_iam_role_policy_attachment" "download_audit_logging" {
  role       = aws_iam_role.download_role.name
  policy_arn = aws_iam_policy.audit_logging_policy.arn
}

resource "aws_lambda_function" "download" {
  function_name    = "secure-file-download"
  runtime          = "python3.11"
  role             = aws_iam_role.download_role.arn
  handler          = "main.handler"

  filename         = "${path.module}/download.zip"
  source_code_hash = filebase64sha256("${path.module}/download/main.py")

  environment {
    variables = {
      BUCKET_NAME         = var.bucket_name
      KMS_KEY_ID          = var.kms_key_id
      FILES_TABLE         = var.files_table_name
      USERS_TABLE         = var.users_table_name
      GENERAL_AUDIT_TABLE = var.general_audit_table_name
    }
  }
}

resource "aws_lambda_permission" "allow_apigw_download" {
  statement_id  = "AllowAPIGatewayInvokeDownload"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.download.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*/api/files/*/download"
}

output "download_lambda_arn" {
  description = "ARN of the secure-file-download Lambda function"
  value       = aws_lambda_function.download.arn
}
