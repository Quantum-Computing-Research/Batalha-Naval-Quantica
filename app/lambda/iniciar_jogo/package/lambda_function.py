import json
import os
import redis

valkey_endpoint = os.getenv('VALKEY_ENDPOINT')
redis_client = redis.Redis(host=valkey_endpoint, port=6379, decode_responses=True)

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    route_key = event['requestContext']['routeKey']

    if route_key == '$connect':
        redis_client.set(connection_id, 'conectado')
        mensagem = f"Conectado: {connection_id}"

    elif route_key == '$disconnect':
        redis_client.delete(connection_id)
        mensagem = f"Desconectado: {connection_id}"

    else:
        mensagem = f"Ação recebida: {route_key}"

    return {'statusCode': 200, 'body': mensagem}

