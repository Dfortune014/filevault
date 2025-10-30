resource "aws_dynamodb_table" "filevault_users" {
  name         = "FileVaultUsers"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  # For delegated viewer mapping
  attribute {
    name = "delegatedEditor"
    type = "S"
  }

  global_secondary_index {
    name            = "delegatedEditor-index"
    hash_key        = "delegatedEditor"
    projection_type = "ALL"
  }

  tags = {
    Project = "SecureFileVault"
    Purpose = "UserManagement"
  }
}
