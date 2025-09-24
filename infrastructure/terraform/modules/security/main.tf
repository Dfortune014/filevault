# IAM ROLES

# Admin role - full access
resource "aws_iam_role" "admin_role" {
  name               = "${var.project_name}-admin-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Editor role - read/write
resource "aws_iam_role" "editor_role" {
  name               = "${var.project_name}-editor-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Viewer role - read-only
resource "aws_iam_role" "viewer_role" {
  name               = "${var.project_name}-viewer-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Common assume role policy
data "aws_iam_policy_document" "assume" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"] # later can be Cognito identities
    }
  }
}

# IAM POLICIES

# Attach policies
resource "aws_iam_role_policy" "admin_policy" {
  role   = aws_iam_role.admin_role.id
  policy = data.aws_iam_policy_document.admin.json
}

resource "aws_iam_role_policy" "editor_policy" {
  role   = aws_iam_role.editor_role.id
  policy = data.aws_iam_policy_document.editor.json
}

resource "aws_iam_role_policy" "viewer_policy" {
  role   = aws_iam_role.viewer_role.id
  policy = data.aws_iam_policy_document.viewer.json
}

# IAM policy docs
data "aws_iam_policy_document" "admin" {
  statement {
    effect    = "Allow"
    actions   = var.admin_actions
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "editor" {
  statement {
    effect  = "Allow"
    actions = var.editor_actions
    resources = [
      var.bucket_arn,
      "${var.bucket_arn}/*"
    ]
  }
}

data "aws_iam_policy_document" "viewer" {
  statement {
    effect  = "Allow"
    actions = var.viewer_actions
    resources = ["${var.bucket_arn}/*"]
  }
}

# CLOUDTRAIL LOGGING

# Dedicated S3 bucket for logs
resource "aws_s3_bucket" "cloudtrail_logs" {
  bucket        = "${var.project_name}-cloudtrail-logs"
  force_destroy = true
}

# CloudTrail configuration
resource "aws_cloudtrail" "main" {
  name                          = "${var.project_name}-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail_logs.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
}

# Allow CloudTrail to write logs to this bucket
resource "aws_s3_bucket_policy" "cloudtrail_logs_policy" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck",
        Effect    = "Allow",
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        },
        Action   = "s3:GetBucketAcl",
        Resource = aws_s3_bucket.cloudtrail_logs.arn
      },
      {
        Sid       = "AWSCloudTrailWrite",
        Effect    = "Allow",
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        },
        Action   = "s3:PutObject",
        Resource = "${aws_s3_bucket.cloudtrail_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*",
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

# Needed to fetch account ID dynamically
data "aws_caller_identity" "current" {}
