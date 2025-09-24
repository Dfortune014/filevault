#############################################
# Cognito Identity Pool
#############################################
resource "aws_cognito_identity_pool" "this" {
  identity_pool_name               = "${var.user_pool_name}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.this.id
    provider_name           = aws_cognito_user_pool.this.endpoint
    server_side_token_check = true
  }
}

#############################################
# Identity Pool Roles Attachment (Trust Cognito:Roles)
#############################################
resource "aws_cognito_identity_pool_roles_attachment" "this" {
  identity_pool_id = aws_cognito_identity_pool.this.id

  role_mapping {
    identity_provider         = "${aws_cognito_user_pool.this.endpoint}:${aws_cognito_user_pool_client.this.id}"
    type                      = "Token"
    ambiguous_role_resolution = "AuthenticatedRole"
  }

  roles = {
    authenticated = aws_iam_role.viewers.arn # fallback = least privilege
  }
}
