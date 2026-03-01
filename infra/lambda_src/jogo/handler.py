import os
import json
import time
import uuid
import logging
from typing import Any, Dict, Tuple, Optional

import boto3

# Seu engine do jogo
from game import Jogo  # precisa estar no zip do lambda_src

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

GAME_TABLE = os.environ.get("GAME_TABLE", "")
CACHE_BUCKET = os.environ.get("CACHE_BUCKET", "")
CACHE_PREFIX = os.environ.get("CACHE_PREFIX", "cache/")
GAME_TTL_SECONDS = int(os.environ.get("GAME_TTL_SECONDS", "21600"))  # 6h default
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

if not GAME_TABLE:
    raise RuntimeError("Missing env GAME_TABLE")

table = dynamodb.Table(GAME_TABLE)

# ----------------------------
# Helpers HTTP (APIGW v2.0)
# ----------------------------

def _resp(status: int, body: Any, extra_headers: Optional[Dict[str, str]] = None):
    headers = {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": CORS_ORIGIN,
        "access-control-allow-headers": "content-type,x-game-id",
        "access-control-allow-methods": "GET,POST,OPTIONS",
    }
    if extra_headers:
        headers.update(extra_headers)
    return {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(body, ensure_ascii=False),
    }

def _parse_json_body(event: Dict[str, Any]) -> Dict[str, Any]:
    body = event.get("body")
    if not body:
        return {}
    if event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body).decode("utf-8", errors="replace")
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {}

def _method_path(event: Dict[str, Any]) -> Tuple[str, str]:
    rc = event.get("requestContext", {}) or {}
    http = rc.get("http", {}) or {}
    method = (http.get("method") or event.get("httpMethod") or "").upper()
    path = event.get("rawPath") or event.get("path") or "/"
    return method, path

def _get_game_id(event: Dict[str, Any], body: Dict[str, Any]) -> Optional[str]:
    headers = event.get("headers") or {}
    # API Gateway normaliza pra lowercase às vezes
    game_id = headers.get("x-game-id") or headers.get("X-Game-Id")
    if not game_id:
        game_id = body.get("game_id")
    return game_id

# ----------------------------
# Helpers Estado (Dynamo)
# ----------------------------

def _ttl_epoch(seconds_from_now: int) -> int:
    return int(time.time()) + seconds_from_now

def _dynamo_put_game(game_id: str, state: Dict[str, Any]):
    item = {
        "game_id": game_id,
        "ttl": _ttl_epoch(GAME_TTL_SECONDS),
        "state": state,
        "updated_at": int(time.time()),
    }
    table.put_item(Item=item)

def _dynamo_get_game(game_id: str) -> Optional[Dict[str, Any]]:
    resp = table.get_item(Key={"game_id": game_id})
    item = resp.get("Item")
    if not item:
        return None
    return item.get("state")

def _dynamo_delete_game(game_id: str):
    table.delete_item(Key={"game_id": game_id})

# ----------------------------
# Cache S3 (jogadas quânticas)
# ----------------------------

def _load_moves_from_s3(backend: str) -> Optional[list]:
    """
    Espera encontrar, por exemplo:
      s3://<CACHE_BUCKET>/<CACHE_PREFIX>/<backend>.json
    Ex: cache/ionq_aria1.json
    Conteúdo: {"moves": ["A1","B7",...]} ou uma lista direta ["A1",...]
    """
    if not CACHE_BUCKET:
        return None
    key = f"{CACHE_PREFIX.rstrip('/')}/{backend}.json"
    try:
        obj = s3.get_object(Bucket=CACHE_BUCKET, Key=key)
        raw = obj["Body"].read().decode("utf-8", errors="replace")
        data = json.loads(raw)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "moves" in data and isinstance(data["moves"], list):
            return data["moves"]
        return None
    except s3.exceptions.NoSuchKey:
        logger.warning("Cache file not found in S3: %s/%s", CACHE_BUCKET, key)
        return None
    except Exception as e:
        logger.exception("Failed to load cache from S3: %s", e)
        return None

# ----------------------------
# Serialização mínima do jogo
# ----------------------------

def _game_to_state(game: Jogo, meta: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aqui a gente salva o que precisa para reconstruir o Jogo.
    Se o seu Jogo já tem to_dict/from_dict, melhor ainda.
    """
    return {
        "meta": meta,
        "tamanho_tabuleiro": getattr(game, "tamanho_tabuleiro", 10),
        "num_navios": getattr(game, "num_navios", 4),
        "vez_do_jogador": getattr(game, "vez_do_jogador", True),
        "tabuleiro_jogador": game.tabuleiro_jogador,
        "tabuleiro_quantico": getattr(game, "tabuleiro_quantico", None),
        # pilha de jogadas quânticas (strings tipo "A1")
        "pilha": meta.get("pilha", []),
        "ranking": meta.get("ranking", []),
        "fila_espera": meta.get("fila_espera", []),
        "em_andamento": meta.get("em_andamento", True),
        "jogador": meta.get("jogador", ""),
        "backend": meta.get("backend", ""),
    }

def _state_to_game(state: Dict[str, Any]) -> Jogo:
    game = Jogo(
        tamanho_tabuleiro=int(state.get("tamanho_tabuleiro", 10)),
        num_navios=int(state.get("num_navios", 4)),
    )
    # restaura o que seu Jogo usa:
    game.tabuleiro_jogador = state["tabuleiro_jogador"]
    if state.get("tabuleiro_quantico") is not None:
        try:
            game.tabuleiro_quantico = state["tabuleiro_quantico"]
        except Exception:
            pass
    try:
        game.vez_do_jogador = state.get("vez_do_jogador", True)
    except Exception:
        pass
    return game

def coord_para_letra_numero(linha, coluna):
    return f"{chr(ord('A') + int(linha))}{coluna + 1}"

# ----------------------------
# Rotas (sem Flask)
# ----------------------------

def handle_iniciar(event):
    body = _parse_json_body(event)
    num_navios = int(str(body.get("num_navios", 4)).strip())
    tamanho_tabuleiro = int(body.get("tamanho_tabuleiro", 10))

    if tamanho_tabuleiro < 5 or tamanho_tabuleiro > 20:
        return _resp(400, {"error": "Tamanho do tabuleiro inválido."})

    jogador = body.get("nome", "")
    backend = body.get("backend", "default")

    # cria jogo
    game = Jogo(tamanho_tabuleiro=tamanho_tabuleiro, num_navios=num_navios)

    # carrega jogadas quânticas do cache do S3 (opcional)
    pilha = _load_moves_from_s3(backend) or []

    # game_id devolvido pro front (guarde e mande no header x-game-id)
    game_id = str(uuid.uuid4())

    ranking = [
        {"nome": "Jogador 1", "pontos": 200},
        {"nome": "Jogador 2", "pontos": 180},
        {"nome": "Jogador 3", "pontos": 150},
    ]
    fila_espera = []

    meta = {
        "em_andamento": True,
        "jogador": jogador,
        "backend": backend,
        "pilha": pilha,
        "ranking": ranking,
        "fila_espera": fila_espera,
    }

    state = _game_to_state(game, meta)
    _dynamo_put_game(game_id, state)

    return _resp(200, {
        "game_id": game_id,
        "ranking": ranking,
        "fila_espera": fila_espera,
        "pilha_len": len(pilha),
        "tabuleiro_jogador": game.tabuleiro_jogador,
    })

def handle_atacar(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id (send header x-game-id or body.game_id)"})

    state = _dynamo_get_game(game_id)
    if not state or not state.get("em_andamento", False):
        return _resp(404, {"error": "Jogo não encontrado ou encerrado."})

    coordenada = body.get("coordenada")
    if not coordenada:
        return _resp(400, {"error": "Missing coordenada"})

    game = _state_to_game(state)

    finalizado, mensagem, acertou, linha, coluna = game.ataque_jogador(coordenada)

    if finalizado:
        mensagem = "Jogo finalizado! Você venceu!"
        state["em_andamento"] = False
    else:
        mensagem = f"Ataque do jogador em {coordenada} → {'Acertou!' if acertou else 'Errou!'}"

    # salva estado atualizado
    state["tabuleiro_jogador"] = game.tabuleiro_jogador
    state["vez_do_jogador"] = getattr(game, "vez_do_jogador", state.get("vez_do_jogador", True))
    _dynamo_put_game(game_id, state)

    return _resp(200, {
        "mensagem": mensagem,
        "status": "acerto" if acertou else "erro",
        "vez_do_jogador": state.get("vez_do_jogador", True),
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "fila_espera": state.get("fila_espera", []),
        "finalizado": finalizado,
    })

def handle_ataque_quantico(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id (send header x-game-id or body.game_id)"})

    state = _dynamo_get_game(game_id)
    if not state or not state.get("em_andamento", False):
        return _resp(404, {"error": "Jogo não encontrado ou encerrado."})

    game = _state_to_game(state)

    # aqui você escolhe como seu Jogo usa a pilha:
    # opção A) se seu game.ataque_quantico() já desempilha internamente, ok.
    # opção B) você desempilha aqui e chama um método específico.
    finalizado, mensagem, acertou, linha, coluna = game.ataque_quantico()

    if finalizado:
        mensagem = "Jogo finalizado! O computador quântico venceu!"
        state["em_andamento"] = False
    else:
        mensagem = f"Ataque quântico em {coord_para_letra_numero(linha, coluna)} → {'Acertou!' if acertou else 'Errou!'}"

    state["tabuleiro_jogador"] = game.tabuleiro_jogador
    state["vez_do_jogador"] = getattr(game, "vez_do_jogador", state.get("vez_do_jogador", True))
    _dynamo_put_game(game_id, state)

    return _resp(200, {
        "jogada_quantica": [linha, coluna],
        "status": "acerto" if acertou else "erro",
        "mensagem": mensagem,
        "vez_do_jogador": state.get("vez_do_jogador", True),
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "finalizado": finalizado,
    })

def handle_encerrar(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id"})

    # opção 1: marca encerrado
    state = _dynamo_get_game(game_id)
    if state:
        state["em_andamento"] = False
        _dynamo_put_game(game_id, state)

    # opção 2 (mais “cache-like”): apaga o item
    # _dynamo_delete_game(game_id)

    return _resp(200, {"status": "jogo encerrado"})

def handle_entrar_fila(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id"})

    nome = body.get("nome")
    if not nome:
        return _resp(400, {"error": "Missing nome"})

    state = _dynamo_get_game(game_id)
    if not state:
        return _resp(404, {"error": "Jogo não encontrado."})

    fila = state.get("fila_espera", [])
    if nome not in fila:
        fila.append(nome)
    state["fila_espera"] = fila
    _dynamo_put_game(game_id, state)

    return _resp(200, {"fila_espera": fila})

def handle_estado(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id"})

    state = _dynamo_get_game(game_id)
    if not state:
        return _resp(404, {"error": "Jogo não encontrado."})

    return _resp(200, {
        "ranking": state.get("ranking", []),
        "fila_espera": state.get("fila_espera", []),
        "em_andamento": state.get("em_andamento", False),
        "backend": state.get("backend", ""),
        "jogador": state.get("jogador", ""),
    })

# ----------------------------
# ENTRYPOINT LAMBDA
# ----------------------------

def handler(event, context):
    method, path = _method_path(event)
    logger.info("REQ %s %s", method, path)

    # preflight
    if method == "OPTIONS":
        return _resp(204, "")

    routes = {
        ("POST", "/iniciar_jogo"): handle_iniciar,
        ("POST", "/atacar"): handle_atacar,
        ("GET",  "/ataque-quantico"): handle_ataque_quantico,
        ("POST", "/encerrar_jogo"): handle_encerrar,
        ("POST", "/fila/entrar"): handle_entrar_fila,
        ("GET",  "/estado"): handle_estado,
    }

    fn = routes.get((method, path))
    if not fn:
        return _resp(404, {"error": f"Route not found: {method} {path}"})

    try:
        return fn(event)
    except Exception as e:
        logger.exception("Unhandled error: %s", e)
        return _resp(500, {"error": "Internal error", "detail": str(e)})