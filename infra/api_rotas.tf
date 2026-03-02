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

resource "aws_apigatewayv2_route" "fila_entrar" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /fila/entrar"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "estado" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /estado"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "backends_status" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /backends/status"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "cache_list" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /cache"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "cache_get" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /cache/{hardware}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}