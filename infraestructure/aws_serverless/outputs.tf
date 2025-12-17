output "instance_ip" {
  value = aws_instance.flask.public_ip
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
}