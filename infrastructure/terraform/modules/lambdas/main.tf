variable "bucket_name" {}
variable "kms_key_id" {}
variable "region" {}
variable "account_id" {}
variable "api_execution_arn" {}

#############################################
# Upload Lambda
#############################################
resource "aws_iam_role" "upload_role" {
  name = "secure-file-upload-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "upload_logging" {
  role       = aws_iam_role.upload_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "upload_policy" {
  role   = aws_iam_role.upload_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:PutObject"],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Effect   = "Allow",
        Action   = ["kms:Encrypt", "kms:GenerateDataKey*"],
        Resource = "arn:aws:kms:${var.region}:${var.account_id}:key/${var.kms_key_id}"
      }
    ]
  })
}

resource "aws_lambda_function" "upload" {
  function_name = "secure-file-upload"
  runtime       = "python3.11"
  role          = aws_iam_role.upload_role.arn
  handler       = "main.handler"
  filename      = "${path.module}/upload.zip"
  
  source_code_hash = filebase64sha256("${path.module}/upload/main.py")

  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
      KMS_KEY_ID  = var.kms_key_id
    }
  }
}

resource "aws_lambda_permission" "allow_apigw_upload" {
  statement_id  = "AllowAPIGatewayInvokeUpload"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*/api/files/upload-url"
}

#############################################
# List Lambda
#############################################
resource "aws_iam_role" "list_role" {
  name = "secure-file-list-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
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
  role   = aws_iam_role.list_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:ListBucket"],
        Resource = "arn:aws:s3:::${var.bucket_name}"
      }
    ]
  })
}

resource "aws_lambda_function" "list" {
  function_name = "secure-file-list"
  runtime       = "python3.11"
  role          = aws_iam_role.list_role.arn
  handler       = "main.handler"
  filename      = "${path.module}/list.zip"

  source_code_hash = filebase64sha256("${path.module}/list/main.py")

  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
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

#############################################
# Download Lambda
#############################################
resource "aws_iam_role" "download_role" {
  name = "secure-file-download-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
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
  role   = aws_iam_role.download_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:GetObject"],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Effect   = "Allow",
        Action   = ["kms:Decrypt"],
        Resource = "arn:aws:kms:${var.region}:${var.account_id}:key/${var.kms_key_id}"
      }
    ]
  })
}

resource "aws_lambda_function" "download" {
  function_name = "secure-file-download"
  runtime       = "python3.11"
  role          = aws_iam_role.download_role.arn
  handler       = "main.handler"
  filename      = "${path.module}/download.zip"

  source_code_hash = filebase64sha256("${path.module}/download/main.py")
  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
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

#############################################
# Delete Lambda
#############################################
resource "aws_iam_role" "delete_role" {
  name = "secure-file-delete-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
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
  role   = aws_iam_role.delete_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:DeleteObject"],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      }
    ]
  })
}

resource "aws_lambda_function" "delete" {
  function_name = "secure-file-delete"
  runtime       = "python3.11"
  role          = aws_iam_role.delete_role.arn
  handler       = "main.handler"
  filename      = "${path.module}/delete.zip"
  
  source_code_hash = filebase64sha256("${path.module}/delete/main.py")
  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
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
