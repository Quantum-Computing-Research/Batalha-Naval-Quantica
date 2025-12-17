output "public_ip" {
  value = aws_instance.flask_server.public_ip
}

output "api_gateway_invoke_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
  description = "URL pública para acessar a aplicação Flask via API Gateway HTTPS"
}