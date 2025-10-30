resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name


  auto_verified_attributes = ["email"]
  
  password_policy {
    minimum_length    = var.password_min_length
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
    temporary_password_validity_days = 7
  }

  mfa_configuration = var.mfa_configuration

  # 👇 Add Lambda trigger only if passed in
  dynamic "lambda_config" {
    for_each = var.post_confirmation_lambda_arn != null ? [1] : []
    content {
      post_confirmation = var.post_confirmation_lambda_arn
    }
  }
}


resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.user_pool_name}-client"
  user_pool_id = aws_cognito_user_pool.this.id

  # No secret since this will be used by web apps
  generate_secret = false

  explicit_auth_flows = [
  "ALLOW_USER_SRP_AUTH",        # ✅ secure login for frontend
  "ALLOW_REFRESH_TOKEN_AUTH",   # ✅ session refresh
  "ALLOW_USER_PASSWORD_AUTH"    # ✅ enables admin-initiate-auth for CLI tests
  ]
}

