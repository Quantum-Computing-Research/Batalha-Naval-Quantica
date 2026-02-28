output "api_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "cache_bucket" {
  value = aws_s3_bucket.cache.bucket
}

output "games_table" {
  value = aws_dynamodb_table.games.name
}

output "lambda_name" {
  value = aws_lambda_function.api.function_name
}