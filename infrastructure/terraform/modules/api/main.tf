#############################################
# API Gateway HTTP API
#############################################
resource "aws_apigatewayv2_api" "this" {
  name          = "secure-file-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Authorization", "Content-Type"]
    allow_methods = ["GET", "PATCH", "POST", "DELETE", "OPTIONS"]
    allow_origins =  var.allowed_origins
  }
}


#############################################
# Cognito Authorizer
#############################################
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id          = aws_apigatewayv2_api.this.id
  name            = "cognito-authorizer"
  authorizer_type = "JWT"

  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${var.user_pool_id}"
  }
}

#############################################
# API Gateway Stages (dev & prod)
#############################################
resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "dev"
  auto_deploy = true
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "prod"
  auto_deploy = true
}

#############################################
# Lambda Integrations
#############################################
resource "aws_apigatewayv2_integration" "upload" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.upload_lambda_arn
  integration_method      = "POST"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_integration" "list" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.list_lambda_arn
  integration_method      = "GET"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_integration" "download" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.download_lambda_arn
  integration_method      = "GET"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_integration" "delete" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.delete_lambda_arn
  integration_method      = "DELETE"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_integration" "list_users" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.list_users_lambda_arn
  integration_method     = "GET"
  payload_format_version = "2.0"
}

#############################################
# API Routes
#############################################
resource "aws_apigatewayv2_route" "upload" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "POST /api/files/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.upload.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "list" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /api/files"
  target             = "integrations/${aws_apigatewayv2_integration.list.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "download" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /api/files/{id}/download"
  target             = "integrations/${aws_apigatewayv2_integration.download.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "delete" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "DELETE /api/files/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.delete.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}
# Users API Route
resource "aws_apigatewayv2_route" "list_users" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /api/users"
  target             = "integrations/${aws_apigatewayv2_integration.list_users.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}
############################################
# API routes for Update role and delegate 
############################################
# PATCH /api/users/{id}/role
resource "aws_apigatewayv2_integration" "update_role" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.update_role_lambda_arn
  integration_method      = "PATCH"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_route" "update_role" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "PATCH /api/users/{id}/role"
  target             = "integrations/${aws_apigatewayv2_integration.update_role.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

# PATCH /api/users/{id}/delegate
resource "aws_apigatewayv2_integration" "update_delegate" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.update_delegate_lambda_arn
  integration_method      = "PATCH"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_route" "update_delegate" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "PATCH /api/users/{id}/delegate"
  target             = "integrations/${aws_apigatewayv2_integration.update_delegate.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}


#############################################
# Get Delegated Users Route (Editor Access)
#############################################
resource "aws_apigatewayv2_integration" "get_delegated_users" {
  api_id                  = aws_apigatewayv2_api.this.id
  integration_type        = "AWS_PROXY"
  integration_uri         = var.get_delegated_users_lambda_arn
  integration_method      = "GET"
  payload_format_version  = "2.0"
}

resource "aws_apigatewayv2_route" "get_delegated_users" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /api/users/delegated"
  target             = "integrations/${aws_apigatewayv2_integration.get_delegated_users.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

####################################################
# Admin Delete
##################################################
# Admin delete integration
resource "aws_apigatewayv2_integration" "admin_delete" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.admin_delete_lambda_arn
  integration_method     = "DELETE"
  payload_format_version = "2.0"
}

# Admin delete route
resource "aws_apigatewayv2_route" "admin_delete" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "DELETE /api/admin/files/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.admin_delete.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

#############################################
# Check MFA Status Route
#############################################
resource "aws_apigatewayv2_integration" "check_mfa_status" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.check_mfa_status_lambda_arn
  integration_method     = "GET"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "check_mfa_status" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /api/auth/mfa-status"
  target             = "integrations/${aws_apigatewayv2_integration.check_mfa_status.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

