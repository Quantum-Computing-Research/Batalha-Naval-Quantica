import os
import redis
import boto3
import json

r = redis.Redis(
    host=os.environ['VALKEY_ENDPOINT'],
    port=6379,
    ssl=True,
    decode_responses=True
)

apigw = boto3.client(
    'apigatewaymanagementapi',
    endpoint_url=os.environ['WEBSOCKET_ENDPOINT']
)

def lambda_handler(event, context):
    connection_id = event["requestContext"]["connectionId"]

    try:
        # 🔸 Escreve valor no Redis
        r.set("chave_de_teste", "Olá do Lambda com Redis! 🧠")

        # 🔸 Lê valor de volta
        valor = r.get("chave_de_teste")

        # 🔸 Envia callback para o client WebSocket
        mensagem = {
            "type": "redis_response",
            "value": valor
        }

        apigw.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(mensagem).encode("utf-8")
        )

        return {
            "statusCode": 200,
            "body": "Callback enviado com sucesso."
        }

    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return {
            "statusCode": 500,
            "body": f"Erro interno: {str(e)}"
        }