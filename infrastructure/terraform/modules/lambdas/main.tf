#############################################
# Secure File Vault - Lambda Module Root
#############################################
# This file exists mainly to:
# 1. Keep Terraform aware of all .tf Lambda files in this directory.
# 2. Manage shared variables, outputs, and references in one place.
# 3. Maintain a clear module entry point for the root module call.
#############################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ───────────────────────────────────────────
# Shared Variables (see variables.tf)
# ───────────────────────────────────────────
# bucket_name
# kms_key_id
# region
# account_id
# api_execution_arn
# user_pool_id
# user_pool_arn
# api_id
# users_table_name
# users_table_arn
# files_table_name
# files_table_arn

# ───────────────────────────────────────────
# Lambda Definitions
# ───────────────────────────────────────────
# Each Lambda (upload, list, download, delete, etc.)
# is defined in its own .tf file for maintainability.
# Terraform automatically loads them all since they
# exist in the same module directory.
#
# No explicit references are required here — resources
# across files can reference each other directly.
# Example:
#   aws_lambda_function.update_role references
#   aws_lambda_function.update_delegate

# ───────────────────────────────────────────
# Outputs (collected from individual Lambda files)
# ───────────────────────────────────────────
# These outputs allow the API module or root stack to
# consume Lambda ARNs for API Gateway integration.
# Example:
#   module "api" {
#     source = "../api"
#     get_delegated_users_lambda_arn = module.lambdas.get_delegated_users_lambda_arn
#   }
