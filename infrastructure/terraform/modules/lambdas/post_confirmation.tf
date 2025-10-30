#############################################
# Secure File Vault - Cognito Post-Confirmation Lambda
#############################################

# ───────────────────────────────────────────
# IAM Role for Post-Confirmation Lambda
# ───────────────────────────────────────────
resource "aws_iam_role" "post_confirmation_role" {
  name = "post-confirmation-lambda-role"

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
resource "aws_iam_role_policy_attachment" "post_confirmation_logging" {
  role       = aws_iam_role.post_confirmation_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ───────────────────────────────────────────
# Cognito Group Management Permissions
# ───────────────────────────────────────────
resource "aws_iam_role_policy" "post_confirmation_manage_groups" {
  role = aws_iam_role.post_confirmation_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser"
        ],
        Resource = "*"
      }
    ]
  })
}

# ───────────────────────────────────────────
# DynamoDB Permissions for User Onboarding
# ───────────────────────────────────────────
resource "aws_iam_policy" "post_confirmation_dynamodb" {
  name        = "filevault-post-confirmation-dynamodb"
  description = "Allow PostConfirmation Lambda to write to FileVaultUsers table"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ],
        Resource = var.users_table_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "post_confirmation_attach_dynamodb" {
  role       = aws_iam_role.post_confirmation_role.name
  policy_arn = aws_iam_policy.post_confirmation_dynamodb.arn
}

# ───────────────────────────────────────────
# Lambda Function Definition
# ───────────────────────────────────────────
resource "aws_lambda_function" "post_confirmation" {
  function_name = "cognito-post-confirmation"
  runtime       = "python3.11"
  role          = aws_iam_role.post_confirmation_role.arn
  handler       = "main.lambda_handler"

  filename         = "${path.module}/post_confirmation.zip"
  source_code_hash = filebase64sha256("${path.module}/post-confirmation/main.py")

  environment {
    variables = {
      USERS_TABLE = var.users_table_name
    }
  }
}

# ───────────────────────────────────────────
# Permission: Allow Cognito to Invoke Lambda
# ───────────────────────────────────────────
resource "aws_lambda_permission" "allow_cognito_postconfirmation" {
  statement_id  = "AllowExecutionFromCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.user_pool_arn
}

# ───────────────────────────────────────────
# Output (ARN for Cognito Integration)
# ───────────────────────────────────────────
output "post_confirmation_arn" {
  description = "ARN of the Cognito Post-Confirmation Lambda function"
  value       = aws_lambda_function.post_confirmation.arn
}
