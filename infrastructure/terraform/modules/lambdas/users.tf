#############################################
# Secure File Vault - List Users Lambda (Admin)
#############################################

# ───────────────────────────────────────────
# IAM Role for Admin Lambdas (Shared)
# ───────────────────────────────────────────
resource "aws_iam_role" "admin_lambdas_role" {
  name = "filevault-admin-lambdas-role"

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
resource "aws_iam_role_policy_attachment" "admin_logs" {
  role       = aws_iam_role.admin_lambdas_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ───────────────────────────────────────────
# DynamoDB Access Policy (User Table)
# ───────────────────────────────────────────
resource "aws_iam_role_policy" "admin_dynamodb_access" {
  name = "filevault-admin-dynamodb-access"
  role = aws_iam_role.admin_lambdas_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ],
        Resource = var.users_table_arn
      }
    ]
  })
}

# ───────────────────────────────────────────
# IAM Policy for Cognito + DynamoDB User Management
# ───────────────────────────────────────────
resource "aws_iam_policy" "admin_user_management" {
  name        = "filevault-admin-user-management"
  description = "Allow admin Lambdas to manage user roles, delegates, and Cognito groups"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      # DynamoDB: Access User Table
      {
        Sid    = "AllowUserTableAccess",
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Resource = [
          var.users_table_arn,
          "${var.users_table_arn}/index/*"
        ]
      },

      # DynamoDB: Access Files Table (optional ownership updates)
      {
        Sid    = "AllowFileTableAccess",
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Resource = [
          var.files_table_arn,
          "${var.files_table_arn}/index/*"
        ]
      },

      # Cognito: Manage Group Membership
      {
        Sid    = "AllowCognitoAdminGroupOps",
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

# Attach to Admin Role
resource "aws_iam_role_policy_attachment" "admin_user_management_attach" {
  role       = aws_iam_role.admin_lambdas_role.name
  policy_arn = aws_iam_policy.admin_user_management.arn
}

# ───────────────────────────────────────────
# Lambda Function Definition
# ───────────────────────────────────────────
resource "aws_lambda_function" "list_users" {
  function_name = "filevault-list-users"
  runtime       = "python3.11"
  role          = aws_iam_role.admin_lambdas_role.arn
  handler       = "main.lambda_handler"

  filename         = "${path.module}/users.zip"
  source_code_hash = filebase64sha256("${path.module}/users/main.py")

  environment {
    variables = {
      USERS_TABLE = var.users_table_name
    }
  }
}

# ───────────────────────────────────────────
# Lambda Permission for API Gateway Invocation
# ───────────────────────────────────────────
resource "aws_lambda_permission" "allow_apigw_list_users" {
  statement_id  = "AllowAPIGatewayInvokeListUsers"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_users.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}

# ───────────────────────────────────────────
# Output (ARN for API Gateway Integration)
# ───────────────────────────────────────────
output "list_users_lambda_arn" {
  description = "ARN of the filevault-list-users Lambda function"
  value       = aws_lambda_function.list_users.arn
}
