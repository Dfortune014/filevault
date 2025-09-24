# Cognito Groups mapped to IAM Roles

resource "aws_cognito_user_group" "admins" {
  name         = "Admins"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Administrators with full access"
  role_arn     = aws_iam_role.admins.arn
}

resource "aws_cognito_user_group" "editors" {
  name         = "Editors"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Editors can upload and edit files"
  role_arn     = aws_iam_role.editors.arn
}

resource "aws_cognito_user_group" "viewers" {
  name         = "Viewers"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Viewers have read-only access"
  role_arn     = aws_iam_role.viewers.arn
}
