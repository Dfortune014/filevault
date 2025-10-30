#############################################
# Secure File Vault - Shared Audit Logging Policy
#############################################

data "aws_iam_policy_document" "audit_logging_policy_doc" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem",
    ]
    resources = [
      var.general_audit_table_arn,
      var.deletion_audit_table_arn
    ]
  }
}

resource "aws_iam_policy" "audit_logging_policy" {
  name   = "secure-filevault-audit-logging"
  policy = data.aws_iam_policy_document.audit_logging_policy_doc.json
}
