resource "aws_dynamodb_table" "filevault_files" {
  name           = "FileVaultFiles"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "fileId"

  # Attributes
  attribute {
    name = "fileId"
    type = "S"
  }

  attribute {
    name = "ownerEmail"
    type = "S"
  }

  attribute {
    name = "delegatedEditor"
    type = "S"
  }

  # ✅ Add this
  attribute {
    name = "ownerId"
    type = "S"
  }

  # Existing index: query by owner email
  global_secondary_index {
    name            = "ownerEmail-index"
    hash_key        = "ownerEmail"
    projection_type = "ALL"
  }

  # ✅ Add this: query by ownerId (used by list lambda)
  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  # Optional: keep your delegated editor index if you use it elsewhere
  global_secondary_index {
    name            = "editor-index"
    hash_key        = "delegatedEditor"
    projection_type = "ALL"
  }

  tags = {
    Project = var.project_name
    Purpose = "FileVault file ownership metadata"
  }
}

# Outputs (unchanged)
output "filevault_files_name" {
  value = aws_dynamodb_table.filevault_files.name
}

output "filevault_files_arn" {
  value = aws_dynamodb_table.filevault_files.arn
}
