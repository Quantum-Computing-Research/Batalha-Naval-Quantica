output "api_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "api_invoke_url_prod" {
  value = aws_apigatewayv2_stage.prod.invoke_url
}

output "cache_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "game_table" {
  value = aws_dynamodb_table.game.name
}

output "lambda_name" {
  value = aws_lambda_function.handler.function_name
}

output "github_lambda_writer_arn" {
  description = "ARN da role assumida pelo GitHub Actions para deploy da Lambda"
  value       = aws_iam_role.github_lambda_writer.arn
}