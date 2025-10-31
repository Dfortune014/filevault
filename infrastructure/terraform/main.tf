module "networking" {
  source              = "./modules/networking"
  vpc_cidr            = var.vpc_cidr
  public_subnet_cidr  = var.public_subnet_cidr
  private_subnet_cidr = var.private_subnet_cidr
  project_name        = var.project_name
}

module "storage" {
  source       = "./modules/storage"
  env          = var.env
  project_name = var.project_name
}

module "security" {
  source       = "./modules/security"
  project_name = var.project_name
  env          = var.env
  bucket_arn   = module.storage.bucket_arn
}

module "auth" {
  source                       = "./modules/auth"
  user_pool_name               = "filevault-pool"
  password_min_length          = 10
  mfa_configuration            = "OFF"
  post_confirmation_lambda_arn = module.lambdas.post_confirmation_arn
}

# API Gateway Module
module "api" {
  source              = "./modules/api"
  region              = var.aws_region
  user_pool_id        = module.auth.user_pool_id
  user_pool_client_id = module.auth.user_pool_client_id

  # Pass Lambda ARNs into the api module
  upload_lambda_arn          = module.lambdas.upload_lambda_arn
  list_lambda_arn            = module.lambdas.list_lambda_arn
  download_lambda_arn        = module.lambdas.download_lambda_arn
  delete_lambda_arn          = module.lambdas.delete_lambda_arn
  list_users_lambda_arn      = module.lambdas.list_users_lambda_arn
  update_role_lambda_arn     = module.lambdas.update_role_lambda_arn
  update_delegate_lambda_arn = module.lambdas.update_delegate_lambda_arn
  get_delegated_users_lambda_arn = module.lambdas.get_delegated_users_lambda_arn
  admin_delete_lambda_arn    = module.lambdas.admin_delete_lambda_arn
}

# Lambda
module "lambdas" {
  source            = "./modules/lambdas"
  bucket_name       = module.storage.bucket_name
  kms_key_id        = module.storage.kms_key_id
  region            = var.aws_region
  account_id        = data.aws_caller_identity.current.account_id
  user_pool_id      = module.auth.user_pool_id
  users_table_name  = module.storage.filevault_users_name
  users_table_arn   = module.storage.filevault_users_arn
  user_pool_arn     = module.auth.user_pool_arn
  files_table_name  = module.storage.filevault_files_name
  files_table_arn   = module.storage.filevault_files_arn
  api_id            = module.api.api_id
  api_execution_arn = module.api.execution_arn
  general_audit_table_name  = module.storage.general_audit_table_name
  general_audit_table_arn   = module.storage.general_audit_table_arn
  deletion_audit_table_name = module.storage.deletion_audit_table_name
  deletion_audit_table_arn  = module.storage.deletion_audit_table_arn
}

# ───────────────────────────────────────────
# KMS Key Policy - Grant Lambda Access
# ───────────────────────────────────────────
resource "aws_kms_key_policy" "filevault" {
  key_id = module.storage.kms_key_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable Lambda Upload Access"
        Effect = "Allow"
        Principal = {
          AWS = module.lambdas.upload_role_arn
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Enable Root Account Access"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
      }
    ]
  })
}