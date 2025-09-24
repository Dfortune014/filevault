output "upload_lambda_arn" {
  value = aws_lambda_function.upload.arn
}

output "list_lambda_arn" {
  value = aws_lambda_function.list.arn
}

output "download_lambda_arn" {
  value = aws_lambda_function.download.arn
}

output "delete_lambda_arn" {
  value = aws_lambda_function.delete.arn
}
