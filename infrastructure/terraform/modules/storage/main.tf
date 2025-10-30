data "aws_caller_identity" "current" {}
data "aws_region" "current" {}


resource "aws_kms_key" "filevault" {
  description             = "KMS CMK for Secure File Portal encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  tags = {
    Name = "${var.project_name}-kms"
  }
}

resource "aws_s3_bucket" "filevault" {
  bucket        = "${var.project_name}-${var.env}-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}-files"
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-files"
    Project     = var.project_name
    Environment = var.env
    AccountID   = data.aws_caller_identity.current.account_id
    Region      = data.aws_region.current.name
  }
}


# Default encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "default" {
  bucket = aws_s3_bucket.filevault.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.filevault.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# Example CORS (adjust for frontend)
resource "aws_s3_bucket_cors_configuration" "filevault" {
  bucket = aws_s3_bucket.filevault.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"] # tighten later, e.g., your frontend domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Basic bucket policy to deny unencrypted uploads
resource "aws_s3_bucket_policy" "filevault" {
  bucket = aws_s3_bucket.filevault.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "DenyUnEncryptedObjectUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.filevault.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_versioning" "filevault" {
  bucket = aws_s3_bucket.filevault.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "filevault" {
  bucket = aws_s3_bucket.filevault.id

  rule {
    id     = "archive-30-days"
    status = "Enabled"

    filter {
      prefix = "" # apply to all objects in the bucket
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 180
    }
  }
}
