#############################################
# DynamoDB - General Audit Log Table
#############################################
resource "aws_dynamodb_table" "general_audit_log" {
  name         = "FileVaultAuditLog"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventType"
  range_key    = "timestamp"

  # --- Table Attributes (must include all used in GSIs)
  attribute {
    name = "eventType"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "actorUserId"
    type = "S"
  }

  attribute {
    name = "targetUserId"
    type = "S"
  }

  # --- Global Secondary Indexes
  global_secondary_index {
    name            = "actorUserId-index"
    hash_key        = "actorUserId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "targetUserId-index"
    hash_key        = "targetUserId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # --- TTL Configuration
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Project = "SecureFileVault"
    Purpose = "GeneralAuditLogging"
  }
}

output "general_audit_table_name" {
  value = aws_dynamodb_table.general_audit_log.name
}

output "general_audit_table_arn" {
  value = aws_dynamodb_table.general_audit_log.arn
}

###########################################################
# DynamoDB - Deletion Audit Log Table (for admin deletes)
###########################################################
resource "aws_dynamodb_table" "deletion_audit_log" {
  name         = "FileVaultDeletionAuditLog"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "auditId"

  attribute {
    name = "auditId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Project = "SecureFileVault"
    Purpose = "DeletionAuditLogging"
  }
}

output "deletion_audit_table_name" {
  value = aws_dynamodb_table.deletion_audit_log.name
}

output "deletion_audit_table_arn" {
  value = aws_dynamodb_table.deletion_audit_log.arn
}
