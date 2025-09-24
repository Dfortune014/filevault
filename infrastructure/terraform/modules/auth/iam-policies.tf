# Admin - Full AWS Access (for demo)
resource "aws_iam_role_policy" "admins_policy" {
  role = aws_iam_role.admins.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}

# Editor - Put, Get, List
resource "aws_iam_role_policy" "editors_policy" {
  role = aws_iam_role.editors.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        "arn:aws:s3:::filevault-files",
        "arn:aws:s3:::filevault-files/*"
      ]
    }]
  })
}

# Viewer - Get, List only
resource "aws_iam_role_policy" "viewers_policy" {
  role = aws_iam_role.viewers.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        "arn:aws:s3:::filevault-files",
        "arn:aws:s3:::filevault-files/*"
      ]
    }]
  })
}
