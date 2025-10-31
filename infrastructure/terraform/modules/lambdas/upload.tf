#############################################
# Secure File Vault - Upload Lambda
#############################################

# ───────────────────────────────────────────
# IAM Role for Upload Lambda
# ───────────────────────────────────────────
resource "aws_iam_role" "upload_role" {
  name = "secure-file-upload-role"

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
resource "aws_iam_role_policy_attachment" "upload_logging" {
  role       = aws_iam_role.upload_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ───────────────────────────────────────────
# Custom Inline Policy for Upload Permissions
# ───────────────────────────────────────────
resource "aws_iam_role_policy" "upload_policy" {
  role = aws_iam_role.upload_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      # S3 Upload Permissions
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:PutObjectAcl"
        ],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },

      # DynamoDB Access - File Metadata Table
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ],
        Resource = "arn:aws:dynamodb:${var.region}:${var.account_id}:table/FileVaultFiles"
      },

      # DynamoDB Access - Users Table (Delegation Lookups)
      {
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ],
        Resource = [
          "arn:aws:dynamodb:${var.region}:${var.account_id}:table/FileVaultUsers",
          "arn:aws:dynamodb:${var.region}:${var.account_id}:table/FileVaultUsers/index/delegatedEditor-index"
        ]
      },

      # KMS Encryption Permissions
      {
        Effect = "Allow",
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ],
        Resource = "arn:aws:kms:${var.region}:${var.account_id}:key/${var.kms_key_id}"
      }
    ]
  })
}

# ───────────────────────────────────────────
# Attach Shared Audit Logging Policy
# ───────────────────────────────────────────
resource "aws_iam_role_policy_attachment" "upload_audit_logging" {
  role       = aws_iam_role.upload_role.name
  policy_arn = aws_iam_policy.audit_logging_policy.arn
}

# ───────────────────────────────────────────
# Lambda Function Definition
# ───────────────────────────────────────────
resource "aws_lambda_function" "upload" {
  function_name    = "secure-file-upload"
  runtime          = "python3.11"
  role             = aws_iam_role.upload_role.arn
  handler          = "main.handler"

  filename         = "${path.module}/upload.zip"
  source_code_hash = filebase64sha256("${path.module}/upload/main.py")

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

# ───────────────────────────────────────────
# Lambda Permission for API Gateway Invocation
# ───────────────────────────────────────────
resource "aws_lambda_permission" "allow_apigw_upload" {
  statement_id  = "AllowAPIGatewayInvokeUpload"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*/api/files/upload-url"
}

# ───────────────────────────────────────────
# Output (ARN for API Gateway Integration)
# ───────────────────────────────────────────
output "upload_lambda_arn" {
  description = "ARN of the secure-file-upload Lambda function"
  value       = aws_lambda_function.upload.arn
}
