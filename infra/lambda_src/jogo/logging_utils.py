from functools import wraps
from flask import request
import json


def log_bloco(titulo, dados):
    if titulo:
        print(f"\n→ {titulo}")

    if isinstance(dados, list):
        if all(isinstance(row, list) for row in dados):  # matriz
            for row in dados:
                print(" ".join(str(x) for x in row))
        elif all(isinstance(x, str) for x in dados):  # lista de strings
            for i in range(0, len(dados), 10):
                print(", ".join(dados[i:i+10]))
        else:  # lista de ints, floats ou mista
            for i in range(0, len(dados), 10):
                print(" ".join(str(x) for x in dados[i:i+10]))

    elif isinstance(dados, dict):
        for chave, valor in dados.items():
            if isinstance(valor, (list, dict)):
                log_bloco(f"{chave}", valor)
            else:
                print(f"{chave}: {valor}")

    else:
        print(dados)




def log_json_completo(titulo, dados):
    print("=" * 60)
    print(titulo)
    print("=" * 60)
    if isinstance(dados, dict):
        for chave, valor in dados.items():
            log_bloco(f"{chave}", valor)
    else:
        log_bloco("", dados)


def log_request_response(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if request.method == "POST":
            dados = request.get_json()
        else:
            dados = request.args

        log_json_completo(f"📤 [REQ] {request.path} — Payload recebido", dados)

        resposta = func(*args, **kwargs)

        if hasattr(resposta, 'get_json'):
            try:
                res_data = resposta.get_json()
            except Exception:
                res_data = str(resposta)
        else:
            res_data = str(resposta)

        log_json_completo(f"📡 [RES] {request.path} — Payload enviado", res_data)

        return resposta
    return wrapper


  # sem cabeçalho por item

