terraform {
  required_version = ">= 1.5.0"

  cloud {
    organization = "Graduate-APPs-USP"
    workspaces {
      name = "Battleship"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4"
    }
  }
}
provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "me" {}

locals {
  name        = var.project_name
  fullname = "${var.project_name}-${var.env}"
  account_id  = data.aws_caller_identity.me.account_id
  bucket_name = "${local.fullname}-cache-${local.account_id}"
}

# -----------------------------
# S3 (cache + history)
# -----------------------------
resource "aws_s3_bucket" "cache" {
  bucket        = local.bucket_name
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "cache" {
  bucket                  = aws_s3_bucket.cache.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cache" {
  bucket = aws_s3_bucket.cache.id
  versioning_configuration { status = "Enabled" }
}

# (opcional) lifecycle: apaga debug/ em 7 dias
resource "aws_s3_bucket_lifecycle_configuration" "cache" {
  bucket = aws_s3_bucket.cache.id

  rule {
    id     = "expire-debug"
    status = "Enabled"

    filter { prefix = "debug/" }

    expiration { days = 7 }
  }
}

# -----------------------------
# DynamoDB (estado do jogo) + TTL
# -----------------------------
resource "aws_dynamodb_table" "games" {
  name         = "${local.fullname}-games"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "game_id"

  attribute {
    name = "game_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# -----------------------------
# Lambda package (zip automático)
# -----------------------------
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/build/${local.fullname}-lambda.zip"
}

# -----------------------------
# IAM Role for Lambda
# -----------------------------
resource "aws_iam_role" "lambda_role" {
  name = "${local.fullname}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

# logs
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Dynamo + S3 (mínimo)
resource "aws_iam_policy" "lambda_data_policy" {
  name = "${local.fullname}-lambda-data-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoGameState"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.games.arn
      },
      {
        Sid    = "S3CacheReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.cache.arn,
          "${aws_s3_bucket.cache.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_data_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_data_policy.arn
}

# -----------------------------
# Lambda Function
# -----------------------------
resource "aws_lambda_function" "api" {
  function_name = "${local.fullname}-api"
  role          = aws_iam_role.lambda_role.arn

  runtime = "python3.12"
  handler = "lambda_app.handler"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  timeout     = 15
  memory_size = 512

  environment {
    variables = {
      GAMES_TABLE       = aws_dynamodb_table.games.name
      CACHE_BUCKET      = aws_s3_bucket.cache.bucket
      CACHE_PREFIX      = var.cache_prefix
      GAME_TTL_SECONDS  = tostring(var.game_ttl_seconds)
      CORS_ORIGIN       = var.cors_origin
    }
  }
}

# -----------------------------
# API Gateway HTTP API
# -----------------------------
resource "aws_apigatewayv2_api" "api" {
  name          = "${local.fullname}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [var.cors_origin]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.arn
  payload_format_version = "2.0"
}

# rotas do jogo
resource "aws_apigatewayv2_route" "iniciar" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /iniciar_jogo"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "atacar" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /atacar"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "ataque_quantico" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /ataque-quantico"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "encerrar" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /encerrar_jogo"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# Permite API Gateway invocar o Lambda
resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}