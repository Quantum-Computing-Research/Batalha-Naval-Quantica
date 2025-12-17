provider "aws" {
  region = var.region
}

# EC2 Instance
# user_data_base64 = base64encode(file("${path.module}/user_data.sh"))
resource "aws_instance" "flask_server" {
  ami           = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  
  associate_public_ip_address = true
  subnet_id = var.subnet_id
  user_data = file("${path.module}/user_data.sh")

  vpc_security_group_ids = [aws_security_group.allow_http.id]

  tags = {
    Name = "FlaskEC2"
  }
}

# Security Group
resource "aws_security_group" "allow_http" {
  name        = "allow_http"
  description = "Allow HTTP and SSH"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Default VPC
data "aws_vpc" "default" {
  default = true
}

# API Gateway HTTP
resource "aws_apigatewayv2_api" "flask_api" {
  name          = "FlaskAPIGateway"
  protocol_type = "HTTP"
}

# Integration HTTP_PROXY (redireciona para EC2)
resource "aws_apigatewayv2_integration" "flask_integration" {
  api_id             = aws_apigatewayv2_api.flask_api.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "http://${aws_instance.flask_server.public_ip}/{proxy}"

  timeout_milliseconds = 30000
}

# Route ANY / (com CORS)
resource "aws_apigatewayv2_route" "flask_route" {
  api_id    = aws_apigatewayv2_api.flask_api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.flask_integration.id}"
}

# CORS habilitado
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.flask_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5000
    throttling_rate_limit  = 10000
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.apigw_logs.arn
    format = jsonencode({
      requestId = "$context.requestId"
      ip        = "$context.identity.sourceIp"
    })
  }
}

# CloudWatch log group (para ver os acessos)
resource "aws_cloudwatch_log_group" "apigw_logs" {
  name              = "/aws/apigateway/flask"
  retention_in_days = 7
}