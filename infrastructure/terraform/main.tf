module "networking" {
  source              = "./modules/networking"
  vpc_cidr            = var.vpc_cidr
  public_subnet_cidr  = var.public_subnet_cidr
  private_subnet_cidr = var.private_subnet_cidr
  project_name        = var.project_name
}

module "storage" {
  source       = "./modules/storage"
  project_name = var.project_name
}

module "security" {
  source       = "./modules/security"
  project_name = var.project_name
  bucket_arn   = module.storage.bucket_arn
}

module "auth" {
  source              = "./modules/auth"
  user_pool_name      = "filevault-pool"
  password_min_length = 10
  mfa_configuration   = "OFF"
}

# API Gateway Module
module "api" {
  source              = "./modules/api"
  region              = var.aws_region
  user_pool_id        = module.auth.user_pool_id
  user_pool_client_id = module.auth.user_pool_client_id

  # Pass Lambda ARNs into the api module
  upload_lambda_arn   = module.lambdas.upload_lambda_arn
  list_lambda_arn     = module.lambdas.list_lambda_arn
  download_lambda_arn = module.lambdas.download_lambda_arn
  delete_lambda_arn   = module.lambdas.delete_lambda_arn
}

# Lambda
module "lambdas" {
  source     = "./modules/lambdas"
  bucket_name = module.storage.bucket_name
  kms_key_id  = module.storage.kms_key_id
  region      = var.aws_region
  account_id        = data.aws_caller_identity.current.account_id
  api_execution_arn = module.api.execution_arn
}

