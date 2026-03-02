import os
import json
import time
import uuid
import logging
from typing import Any, Dict, Tuple, Optional

import boto3

# Seu engine do jogo
from game import Jogo  # precisa estar no zip do lambda

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

GAME_TABLE = os.environ.get("GAME_TABLE", "")
CACHE_BUCKET = os.environ.get("CACHE_BUCKET", "")
CACHE_PREFIX = os.environ.get("CACHE_PREFIX", "cache/")
GAME_TTL_SECONDS = int(os.environ.get("GAME_TTL_SECONDS", "21600"))  # 6h default
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

# Quais arquivos existem no bucket (mapeamento "hardware" -> "filename.json")
# Você pode trocar os nomes à vontade, desde que o front use a chave.
HARDWARE_FILES = {
    "ionq_aria2":   "ionq_aria2.json",
    "ionq_forti1":  "ionq_forti1.json",
    "iqm_garnet":   "iqm_garnet.json",
    "quera_aquila": "quera_aquila.json",
    "rigetti_ankaa": "rigetti_ankaa.json",
}

def _cache_key(filename: str) -> str:
    return f"{CACHE_PREFIX.rstrip('/')}/{filename}"

def _s3_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False

def _load_json_from_s3(bucket: str, key: str):
    obj = s3.get_object(Bucket=bucket, Key=key)
    raw = obj["Body"].read().decode("utf-8", errors="replace")
    return json.loads(raw)

def handle_cache_list(event):
    if not CACHE_BUCKET:
        return _resp(500, {"error": "Missing env CACHE_BUCKET"})

    items = []
    for hw, fname in HARDWARE_FILES.items():
        key = _cache_key(fname)
        online = _s3_exists(CACHE_BUCKET, key)
        items.append({
            "hardware": hw,
            "s3_key": key,
            "online": online,
        })

    return _resp(200, {
        "cache_prefix": CACHE_PREFIX,
        "bucket": CACHE_BUCKET,
        "hardwares": items,
    })

def handle_cache_get(event, hardware: str):
    if not CACHE_BUCKET:
        return _resp(500, {"error": "Missing env CACHE_BUCKET"})

    fname = HARDWARE_FILES.get(hardware)
    if not fname:
        return _resp(404, {"error": f"Unknown hardware: {hardware}", "known": list(HARDWARE_FILES.keys())})

    key = _cache_key(fname)
    if not _s3_exists(CACHE_BUCKET, key):
        return _resp(404, {"error": "Cache not found", "hardware": hardware, "s3_key": key, "backend_offline": True})

    try:
        data = _load_json_from_s3(CACHE_BUCKET, key)
        return _resp(200, {
            "hardware": hardware,
            "s3_key": key,
            "data": data,   # devolve o JSON inteiro do arquivo
        })
    except Exception as e:
        logger.exception("Failed reading cache %s: %s", key, e)
        return _resp(500, {"error": "Failed to load cache", "hardware": hardware})

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

def _method_path(event):
    # HTTP API v2
    rc = event.get("requestContext", {}) or {}
    http = rc.get("http", {}) or {}

    method = http.get("method") or event.get("httpMethod") or "GET"

    # rawPath é o melhor no v2
    path = event.get("rawPath") or http.get("path") or event.get("path") or "/"

    # se você criou stage "prod", o path vem como "/prod/..."
    stage = rc.get("stage")
    if stage and stage != "$default":
        prefix = f"/{stage}"
        if path == prefix:
            path = "/"
        elif path.startswith(prefix + "/"):
            path = path[len(prefix):]  # remove "/prod"

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

def _load_moves_from_s3(backend: str, tamanho_tabuleiro: int) -> Optional[list]:
    """
    Espera:
      s3://<CACHE_BUCKET>/<CACHE_PREFIX>/<backend>/tamanho_<N>.json
    Ex:
      cache/ionq_aria1/tamanho_10.json

    Conteúdo esperado:
      {"moves": ["A1","B7",...]}  (ou lista direta ["A1",...])
    """
    if not CACHE_BUCKET:
        return None

    prefix = CACHE_PREFIX.rstrip("/")
    key = f"{prefix}/{backend}/tamanho_{int(tamanho_tabuleiro)}.json"

    try:
        obj = s3.get_object(Bucket=CACHE_BUCKET, Key=key)
        raw = obj["Body"].read().decode("utf-8", errors="replace")
        data = json.loads(raw)

        if isinstance(data, list):
            return data

        if isinstance(data, dict):
            moves = data.get("moves")
            if isinstance(moves, list):
                return moves

        return None

    except s3.exceptions.NoSuchKey:
        logger.warning("Cache file not found: s3://%s/%s", CACHE_BUCKET, key)
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
        pilha_ataques_quanticos=state.get("pilha", []),  # <<< injeta
    )
    game.tabuleiro_jogador = state["tabuleiro_jogador"]
    if state.get("tabuleiro_quantico") is not None:
        game.tabuleiro_quantico = state["tabuleiro_quantico"]
    game.vez_do_jogador = state.get("vez_do_jogador", True)
    return game

def coord_para_letra_numero(linha, coluna):
    return f"{chr(ord('A') + int(linha))}{coluna + 1}"

# ----------------------------
# Rotas 
# ----------------------------
def handle_iniciar(event):
    body = _parse_json_body(event)

    num_navios = int(str(body.get("num_navios", 4)).strip())
    tamanho_tabuleiro = int(body.get("tamanho_tabuleiro", 10))

    if tamanho_tabuleiro < 5 or tamanho_tabuleiro > 20:
        return _resp(400, {"error": "Tamanho do tabuleiro inválido."})

    jogador = (body.get("nome") or "").strip()
    backend = body.get("backend") or "default"

    # 1) tenta carregar cache primeiro
    pilha = _load_moves_from_s3(backend, tamanho_tabuleiro) or []

    # 2) se não tem jogadas, backend OFFLINE para esse tamanho
    if len(pilha) == 0:
        return _resp(200, {
            "backend_offline": True,
            "backend": backend,
            "tamanho_tabuleiro": tamanho_tabuleiro,
            "motivo": "Sem cache de jogadas para este backend/tamanho."
        })

    # 3) só agora cria o jogo
    game = Jogo(
        tamanho_tabuleiro=tamanho_tabuleiro,
        num_navios=num_navios,
        pilha_ataques_quanticos=pilha,   # <<< injeta no game
    )

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
        "ranking": ranking,
        "fila_espera": fila_espera,
        # opcional: auditoria
        "created_at": int(time.time()),
        "tamanho_tabuleiro": tamanho_tabuleiro,
    }

    state = _game_to_state(game, meta)
    # estado precisa carregar a pilha também
    state["pilha"] = pilha
    _dynamo_put_game(game_id, state)

    return _resp(200, {
        "backend_offline": False,
        "game_id": game_id,
        "backend": backend,
        "tamanho_tabuleiro": tamanho_tabuleiro,
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
    if not state or not state.get("meta", {}).get("em_andamento", False):
        return _resp(404, {"error": "Jogo não encontrado ou encerrado."})

    coordenada = (body.get("coordenada") or "").strip()
    if not coordenada:
        return _resp(400, {"error": "Missing coordenada"})

    game = _state_to_game(state)

    finalizado, _msg, acertou, linha, coluna = game.ataque_jogador(coordenada)

    # mensagem
    if finalizado:
        mensagem = "Jogo finalizado! Você venceu!"
        state["meta"]["em_andamento"] = False
        state["meta"]["ended_at"] = _now_iso()
        vencedor = "jogador"
    else:
        mensagem = f"Ataque do jogador em {coordenada.upper()} → {'Acertou!' if acertou else 'Errou!'}"
        vencedor = None

    # placar + histórico
    if acertou:
        state["meta"]["placar"]["jogador"] = int(state["meta"]["placar"].get("jogador", 0)) + 1

    state["meta"]["historico"].append({
        "t": _now_iso(),
        "tipo": "ataque_jogador",
        "coord": coordenada.upper(),
        "acertou": bool(acertou),
        "linha": linha,
        "coluna": coluna,
    })

    if vencedor:
        state["meta"]["vencedor"] = vencedor

    # persistência completa
    state["tabuleiro_jogador"] = game.tabuleiro_jogador
    state["tabuleiro_quantico"] = game.tabuleiro_quantico
    state["vez_do_jogador"] = game.vez_do_jogador
    state["pilha"] = game.pilha_ataques_quanticos

    _dynamo_put_game(game_id, state)

    # se finalizou, já salva a partida no S3
    if finalizado:
        _persist_partida_e_jogador_no_s3(state)

    return _resp(200, {
        "mensagem": mensagem,
        "status": "acerto" if acertou else "erro",
        "vez_do_jogador": state["vez_do_jogador"],
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "finalizado": bool(finalizado),
    })

def handle_ataque_quantico(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id (send header x-game-id or body.game_id)"})

    state = _dynamo_get_game(game_id)
    if not state or not state.get("meta", {}).get("em_andamento", False):
        return _resp(404, {"error": "Jogo não encontrado ou encerrado."})

    game = _state_to_game(state)

    finalizado, _msg, acertou, linha, coluna = game.ataque_quantico()

    if finalizado:
        mensagem = "Jogo finalizado! O computador quântico venceu!"
        state["meta"]["em_andamento"] = False
        state["meta"]["ended_at"] = _now_iso()
        vencedor = "computador"
    else:
        mensagem = f"Ataque quântico em {coord_para_letra_numero(linha, coluna)} → {'Acertou!' if acertou else 'Errou!'}"
        vencedor = None

    if acertou:
        state["meta"]["placar"]["computador"] = int(state["meta"]["placar"].get("computador", 0)) + 1

    state["meta"]["historico"].append({
        "t": _now_iso(),
        "tipo": "ataque_quantico",
        "coord": coord_para_letra_numero(linha, coluna),
        "acertou": bool(acertou),
        "linha": linha,
        "coluna": coluna,
    })

    if vencedor:
        state["meta"]["vencedor"] = vencedor

    # persistência completa
    state["tabuleiro_jogador"] = game.tabuleiro_jogador
    state["tabuleiro_quantico"] = game.tabuleiro_quantico
    state["vez_do_jogador"] = game.vez_do_jogador
    state["pilha"] = game.pilha_ataques_quanticos

    _dynamo_put_game(game_id, state)

    if finalizado:
        _persist_partida_e_jogador_no_s3(state)

    return _resp(200, {
        "jogada_quantica": [linha, coluna],
        "status": "acerto" if acertou else "erro",
        "mensagem": mensagem,
        "vez_do_jogador": state["vez_do_jogador"],
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "finalizado": bool(finalizado),
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

def _persist_partida_e_jogador_no_s3(state: dict):
    if not CACHE_BUCKET:
        return

    meta = state.get("meta", {})
    partida_id = meta.get("partida_id") or state.get("game_id") or str(uuid.uuid4())
    jogador_id = meta.get("jogador_id") or "jogador_anon"

    # 1) salva a partida completa
    partida_key = f"{MATCH_PREFIX}{partida_id}.json"
    partida_doc = {
        "partida_id": partida_id,
        "created_at": meta.get("created_at"),
        "ended_at": meta.get("ended_at") or _now_iso(),
        "backend": meta.get("backend"),
        "jogador": {
            "id": jogador_id,
            "nome": meta.get("jogador_nome", ""),
        },
        "tamanho_tabuleiro": state.get("tamanho_tabuleiro"),
        "num_navios": state.get("num_navios"),
        "placar": meta.get("placar", {}),
        "vencedor": meta.get("vencedor"),
        "historico": meta.get("historico", []),
        # opcional: snapshot final (útil pra auditoria/replay)
        "snapshot": {
            "tabuleiro_jogador": state.get("tabuleiro_jogador"),
            "tabuleiro_quantico": state.get("tabuleiro_quantico"),
            "pilha_restante": state.get("pilha", []),
        },
    }
    _s3_put_json(partida_key, partida_doc)

    # 2) atualiza índice do jogador
    jogador_key = f"{PLAYER_PREFIX}{jogador_id}.json"
    try:
        jogador_doc = _s3_get_json(jogador_key)
    except s3.exceptions.NoSuchKey:
        jogador_doc = {
            "id": jogador_id,
            "nome": meta.get("jogador_nome", ""),
            "pontuacao_global": {
                "pontos_totais": 0,
                "vitorias": 0,
                "derrotas": 0,
                "melhor_pontuacao_partida": 0,
            },
            "hardwares_jogados": [],
            "partidas": [],  # <- só ids
        }

    backend = meta.get("backend")
    if backend and backend not in jogador_doc.get("hardwares_jogados", []):
        jogador_doc["hardwares_jogados"].append(backend)

    # define pontos da partida (aqui usei placar do jogador como métrica)
    pontos_partida = int(meta.get("placar", {}).get("jogador", 0))
    jogador_doc["pontuacao_global"]["pontos_totais"] += pontos_partida
    jogador_doc["pontuacao_global"]["melhor_pontuacao_partida"] = max(
        int(jogador_doc["pontuacao_global"].get("melhor_pontuacao_partida", 0)),
        pontos_partida,
    )

    venceu = meta.get("vencedor") == "jogador"
    if meta.get("vencedor") in ("jogador", "computador"):
        if venceu:
            jogador_doc["pontuacao_global"]["vitorias"] += 1
        else:
            jogador_doc["pontuacao_global"]["derrotas"] += 1

    # adiciona somente referência
    jogador_doc["partidas"].append({
        "id_partida": partida_id,
        "data": meta.get("ended_at") or _now_iso(),
        "hardware": backend,
        "tamanho_tabuleiro": f"{state.get('tamanho_tabuleiro')}x{state.get('tamanho_tabuleiro')}",
        "pontos": pontos_partida,
        "vencedor": meta.get("vencedor"),
    })

    _s3_put_json(jogador_key, jogador_doc)

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

import re
import uuid
from datetime import datetime, timezone

PLAYER_PREFIX = "jogadores/"
MATCH_PREFIX  = "partidas/"

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

def _safe_slug(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9_-]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_") or "anon"

def _player_id_from_name(nome: str) -> str:
    # determinístico: mesmo nome → mesmo id (bom p/ teste)
    h = uuid.uuid5(uuid.NAMESPACE_DNS, (nome or "").strip().lower()).hex[:10]
    return f"jogador_{h}"

def _cache_key(backend: str, tamanho: int) -> str:
    backend = _safe_slug(backend)
    return f"{CACHE_PREFIX.rstrip('/')}/{backend}/{int(tamanho)}.json"

def _cache_key_fallback(backend: str) -> str:
    backend = _safe_slug(backend)
    return f"{CACHE_PREFIX.rstrip('/')}/{backend}.json"

def _s3_get_json(key: str):
    obj = s3.get_object(Bucket=CACHE_BUCKET, Key=key)
    raw = obj["Body"].read().decode("utf-8", errors="replace")
    return json.loads(raw)

def _s3_put_json(key: str, data: dict):
    s3.put_object(
        Bucket=CACHE_BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json; charset=utf-8",
    )

def _s3_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False

def _list_known_backends() -> list:
    """
    Opção A (mais simples): hardcode inicial.
    Opção B: listar prefixos em cache/ via list_objects_v2 Delimiter="/".
    """
    return [
        "ionq_aria1",
        "ionq_aria2",
        "iqm_garnet",
        "quera_aquila",
        "rigetti_ankaa",
    ]

def handle_backends_status(event):
    # pega querystring
    qs = event.get("queryStringParameters") or {}
    tamanho_tabuleiro = int(qs.get("tamanho_tabuleiro") or 10)

    prefix = CACHE_PREFIX.rstrip("/")
    backends = _list_known_backends()

    out = []
    for backend in backends:
        key = f"{prefix}/{backend}/tamanho_{tamanho_tabuleiro}.json"
        if not CACHE_BUCKET:
            out.append({"backend": backend, "online": False, "moves_count": 0})
            continue

        if not _s3_exists(CACHE_BUCKET, key):
            out.append({"backend": backend, "online": False, "moves_count": 0})
            continue

        # se quiser "moves_count" sem baixar o arquivo inteiro:
        # - dá pra armazenar no próprio JSON um campo "moves_count"
        # - ou aceitar baixar (cache é pequeno)
        moves = _load_moves_from_s3(backend, tamanho_tabuleiro) or []
        out.append({"backend": backend, "online": len(moves) > 0, "moves_count": len(moves)})

    return _resp(200, {
        "tamanho_tabuleiro": tamanho_tabuleiro,
        "backends": out
    })
# ----------------------------
# ENTRYPOINT LAMBDA
# ----------------------------

def handler(event, context):
    method, path = _method_path(event)
    logger.info("REQ %s %s", method, path)

    if method == "OPTIONS":
        return _resp(204, "")

    # rotas "dinâmicas" primeiro
    if method == "GET" and path == "/cache":
        return handle_cache_list(event)

    if method == "GET" and path.startswith("/cache/"):
        hardware = path.split("/cache/", 1)[1].strip("/")
        return handle_cache_get(event, hardware)

    routes = {
        ("POST", "/iniciar_jogo"): handle_iniciar,
        ("POST", "/atacar"): handle_atacar,
        ("GET",  "/ataque-quantico"): handle_ataque_quantico,
        ("POST", "/encerrar_jogo"): handle_encerrar,
        ("POST", "/fila/entrar"): handle_entrar_fila,
        ("GET",  "/estado"): handle_estado,
        ("GET", "/backends/status"): handle_backends_status,
    }

    fn = routes.get((method, path))
    if not fn:
        return _resp(404, {"error": f"Route not found: {method} {path}"})

    try:
        return fn(event)
    except Exception as e:
        logger.exception("Unhandled error: %s", e)
        return _resp(500, {"error": "Internal error", "detail": str(e)})