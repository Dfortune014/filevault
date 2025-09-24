#############################################
# API Gateway HTTP API
#############################################
resource "aws_apigatewayv2_api" "this" {
  name          = "secure-file-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Authorization", "Content-Type"]
    allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_origins = ["*"] # later restrict to your frontend domain
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
