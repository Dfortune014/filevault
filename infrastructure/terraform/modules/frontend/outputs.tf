output "bucket_id" {
  description = "S3 bucket ID for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "bucket_arn" {
  description = "S3 bucket ARN for frontend"
  value       = aws_s3_bucket.frontend.arn
}

output "website_endpoint" {
  description = "S3 website endpoint (when using S3 website hosting)"
  value       = var.enable_cloudfront ? null : aws_s3_bucket_website_configuration.frontend[0].website_endpoint
}

output "website_url" {
  description = "S3 website URL (when using S3 website hosting)"
  value       = var.enable_cloudfront ? null : "http://${aws_s3_bucket_website_configuration.frontend[0].website_endpoint}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].id : null
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].domain_name : null
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].arn : null
}

output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.frontend[0].domain_name}" : null
}

output "frontend_url" {
  description = "Frontend URL (CloudFront or S3 website)"
  value       = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.frontend[0].domain_name}" : "http://${aws_s3_bucket_website_configuration.frontend[0].website_endpoint}"
}

output "waf_acl_id" {
  description = "WAF Web ACL ID"
  value       = var.enable_cloudfront ? aws_wafv2_web_acl.frontend[0].id : null
}

output "waf_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = var.enable_cloudfront ? aws_wafv2_web_acl.frontend[0].arn : null
}

output "logs_bucket_id" {
  description = "S3 bucket ID for CloudFront logs"
  value       = var.enable_cloudfront ? aws_s3_bucket.logs[0].id : null
}