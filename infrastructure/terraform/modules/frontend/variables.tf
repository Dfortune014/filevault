variable "project_name" {
  description = "Name prefix for project resources"
  type        = string
}

variable "env" {
  description = "Environment name (e.g. dev, staging, prod)"
  type        = string
}

variable "custom_domain" {
  description = "Custom domain name for CloudFront distribution (optional)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain (optional)"
  type        = string
  default     = ""
}

variable "api_endpoint" {
  description = "API Gateway endpoint for CSP header"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution (set to false for S3 website hosting)"
  type        = bool
  default     = false
}