provider "aws" {
  region = "us-east-1"
}

resource "aws_security_group" "flask_sg" {
  name        = "flask-sg"
  description = "Allow inbound traffic to Flask"
  vpc_id      = data.aws_vpc.default.id  # ← obrigatório!

  ingress {
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
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

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_instance" "flask" {
  ami                         = "ami-0c7217cdde317cfec"
  instance_type               = "t2.micro"
  key_name                    = var.key_name
  subnet_id                   = data.aws_subnets.default.ids[0]
  associate_public_ip_address = true

  vpc_security_group_ids      = [aws_security_group.flask_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              sudo apt update -y
              sudo apt install python3-pip -y
              pip3 install flask
              echo "
from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello from Flask on EC2!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
              " > app.py
              nohup python3 app.py > flask.log 2>&1 &
              EOF

  tags = {
    Name = "FlaskApp"
  }
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_apigatewayv2_api" "api" {
  name          = "flask-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "integration" {
  api_id             = aws_apigatewayv2_api.api.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "http://${aws_instance.flask.public_ip}:5000"
  integration_method = "ANY"
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "default_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.integration.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}