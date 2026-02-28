import time
import logging
from quantum_task import QuantumTask

from flask import Flask, request, jsonify
from logging_utils import log_request_response
from game import Jogo
from flask_cors import CORS
import random
from logging_utils import log_bloco

app = Flask(__name__)
CORS(app)

# === ESTADO GLOBAL ===
ranking = [
    {"nome": "Jogador 1", "pontos": 200},
    {"nome": "Jogador 2", "pontos": 180},
    {"nome": "Jogador 3", "pontos": 150}
]

fila_espera = []
jogo_ativo = {
    "em_andamento": False,
    "jogador": "",
    "backend": "",
    "pilha": []
}

@app.route("/atacar", methods=["POST"])
@log_request_response
def atacar():
    dados = request.get_json()
    coordenada = dados.get("coordenada")

    game = jogo_ativo["game"]

    imprimir_tabuleiro_quantico_em_bloco(game)

    finalizado, mensagem, acertou, linha, coluna = game.ataque_jogador(coordenada)

    if finalizado:
        mensagem = "Jogo finalizado! Você venceu!"
    else:
        #Sobrescreve a mensagem em caso de sucesso
        mensagem = f"Ataque do jogador em {coordenada} → {'Acertou!' if acertou else 'Errou!'}"


    return jsonify({
        "mensagem": mensagem,
        "status": "acerto" if acertou else "erro",
        "vez_do_jogador": game.vez_do_jogador,
        "tabuleiro_jogador": game.tabuleiro_jogador,
        "fila_espera": fila_espera,
        "finalizado": finalizado
    })

@app.route('/ataque-quantico', methods=['GET'])
@log_request_response
def ataque_quantico():
    game = jogo_ativo["game"]

    finalizado, mensagem, acertou, linha, coluna = game.ataque_quantico()

    print("debug em app")
    print(linha)
    print(coluna)

    if finalizado:
        mensagem = "Jogo finalizado! O computador quantico venceu!"
    else:
        #Sobrescreve a mensagem em caso de sucesso
        mensagem = f"Ataque quântico em {coord_para_letra_numero(linha, coluna)} → {'Acertou!' if acertou else 'Errou!'}"

    return jsonify({
        "jogada_quantica": [linha, coluna],
        "status": "acerto" if acertou else "erro",
        "mensagem": mensagem,
        "vez_do_jogador": game.vez_do_jogador,
        "tabuleiro_jogador": game.tabuleiro_jogador,
        "finalizado": finalizado
    })

def gerar_jogadas_quanticas(n=100):
    letras = 'ABCDEFGHIJ'
    return [f"{random.choice(letras)}{random.randint(1, 10)}" for _ in range(n)]

def coord_para_letra_numero(linha, coluna):
    return f"{chr(ord('A') + int(linha))}{coluna + 1}"

# === ROTAS ===
@app.route("/iniciar_jogo", methods=["POST"])
@log_request_response
def iniciar_jogo():
    global game
    dados = request.get_json()
    num_navios = int(str(dados.get('num_navios', 4)).strip())
    tamanho_tabuleiro = int(dados.get('tamanho_tabuleiro', 10))

    if tamanho_tabuleiro < 5 or tamanho_tabuleiro > 20:
        return jsonify({mensagem: "Tamanho do tabuleiro inválido."})
    breakpoint()
    game = Jogo(tamanho_tabuleiro=tamanho_tabuleiro, num_navios=num_navios)
    jogo_ativo["em_andamento"] = True
    jogo_ativo["jogador"] = dados.get("nome")
    jogo_ativo["backend"] = dados.get("backend")
    jogo_ativo["pilha"] = gerar_jogadas_quanticas()
    jogo_ativo["game"] = game

    return jsonify({
        "ranking": ranking,
        "fila_espera": fila_espera,
        "pilha": jogo_ativo["pilha"],
        "tabuleiro_jogador": game.tabuleiro_jogador
    })

def imprimir_tabuleiro_quantico_em_bloco(jogo):
    print("\n" + "=" * 60)
    print(" TABULEIRO QUÂNTICO")
    print("=" * 60)
    for linha in jogo.tabuleiro_quantico:
        print(" ".join(str(celula) for celula in linha))


@app.route("/encerrar_jogo", methods=["POST"])
@log_request_response
def encerrar_jogo():
    jogo_ativo["em_andamento"] = False
    jogo_ativo["jogador"] = ""
    jogo_ativo["backend"] = ""
    jogo_ativo["pilha"] = []
    return jsonify({"status": "jogo encerrado"})

@app.route("/fila/entrar", methods=["POST"])
@log_request_response
def entrar_fila():
    dados = request.get_json()
    nome = dados.get("nome")
    if nome and nome not in fila_espera:
        fila_espera.append(nome)
    return jsonify({"fila_espera": fila_espera})

@app.route("/estado", methods=["GET"])
@log_request_response
def estado():
    return jsonify({"ranking": ranking, "fila_espera": fila_espera})

if __name__ == "__main__":
    # setup_logging()
    logger = logging.getLogger(__name__)

    gerenciador_cache = QuantumTask.iniciar_em_background()
    logger.info("O serviço de gerenciamento de cache foi iniciado.")

    logger.info("Iniciando o servidor web...")
    app.run(host="0.0.0.0", port=5000)
