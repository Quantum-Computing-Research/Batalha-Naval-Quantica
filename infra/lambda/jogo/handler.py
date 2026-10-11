import os
import json
import time
import uuid
import logging
import math
import random
from decimal import Decimal
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
BONUS_TEMPO_LIMITE_SEGUNDOS = 600
PENALIDADE_JOGADA_EXTRA = 1

# Quais arquivos existem no bucket (mapeamento "hardware" -> "filename.json")
# Você pode trocar os nomes à vontade, desde que o front use a chave.
HARDWARE_FILES = {
    "aqt_ibex_q1":  "aqt_ibex_q1.json",
    "ionq_forte":   "ionq_forti1.json",
    "iqm_emerald":  "iqm_emerald.json",
    "iqm_garnet":   "iqm_garnet.json",
    "quera_aquila": "quera_aquila.json",
    "rigetti_cepheus": "rigetti_cepheus.json",
}

def _hardware_cache_key(filename: str) -> str:
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
        legado = _hardware_cache_key(fname)
        tamanhos = {}
        tamanhos_sinteticos = 0
        for tamanho in (4, 8, 16):
            moves, origem = _load_moves_from_s3_with_source(hw, tamanho)
            if moves:
                tamanhos[tamanho] = {"moves_count": len(moves), "origem": origem}
                if origem == "simulador_cache_v0":
                    tamanhos_sinteticos += 1
        cache_legado = _s3_exists(CACHE_BUCKET, legado)
        online = True
        items.append({
            "hardware": hw,
            "s3_key": legado,
            "online": online,
            "moves_count": sum(item["moves_count"] for item in tamanhos.values()),
            "tamanhos": tamanhos,
            "cache_mock_disponivel": True,
            "cache_legado_disponivel": cache_legado,
            "tamanhos_com_cache_sintetico": tamanhos_sinteticos,
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

    key = _hardware_cache_key(fname)
    if _s3_exists(CACHE_BUCKET, key):
        try:
            return _resp(200, {"hardware": hardware, "s3_key": key, "data": _load_json_from_s3(CACHE_BUCKET, key)})
        except Exception:
            logger.exception("Failed reading cache %s", key)
            return _resp(500, {"error": "Failed to load cache", "hardware": hardware})

    dados_por_tamanho = {}
    fontes = set()
    for tamanho in (4, 8, 16):
        moves, origem = _load_moves_from_s3_with_source(hardware, tamanho)
        if moves:
            dados_por_tamanho[f"tamanho_tabuleiro_{tamanho}"] = moves
            fontes.add(origem)
    if not dados_por_tamanho:
        return _resp(404, {"error": "Cache ainda não gerado", "hardware": hardware, "backend_offline": True})
    return _resp(200, {
        "hardware": hardware,
        "s3_key": f"{CACHE_PREFIX.rstrip('/')}/{hardware}/",
        "data": {"hardware": hardware, "origem_jogadas": sorted(fontes), "data": dados_por_tamanho},
    })

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
        "body": json.dumps(body, ensure_ascii=False, default=lambda value: int(value) if isinstance(value, Decimal) and value == int(value) else float(value)),
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
    resp = table.get_item(Key={"game_id": game_id}, ConsistentRead=True)
    item = resp.get("Item")
    if not item or int(item.get("ttl", 0)) <= int(time.time()):
        return None
    return item.get("state")

def _dynamo_delete_game(game_id: str):
    table.delete_item(Key={"game_id": game_id})

# ----------------------------
# Cache S3 (jogadas quânticas)
# ----------------------------

def _load_moves_from_s3(backend: str, tamanho_tabuleiro: int) -> Optional[list]:
    moves, _origem = _load_moves_from_s3_with_source(backend, tamanho_tabuleiro)
    return moves

def _load_moves_from_s3_with_source(backend: str, tamanho_tabuleiro: int) -> Tuple[list, Optional[str]]:
    """
    Espera:
      s3://<CACHE_BUCKET>/<CACHE_PREFIX>/<backend>/tamanho_<N>.json
    Ex:
      cache/ionq_aria1/tamanho_10.json

    Conteúdo esperado:
      {"moves": ["A1","B7",...]}  (ou lista direta ["A1",...])
    """
    if not CACHE_BUCKET:
        return [], None

    prefix = CACHE_PREFIX.rstrip("/")
    keys = [
        f"{prefix}/{backend}/tamanho_{tamanho_tabuleiro}.json",
        f"{prefix}/{backend}/{tamanho_tabuleiro}.json",
        f"{prefix}/{backend}.json",
    ]
    for key in keys:
        try:
            data = _load_json_from_s3(CACHE_BUCKET, key)
        except s3.exceptions.NoSuchKey:
            continue
        moves = _normalize_moves(data, tamanho_tabuleiro)
        if moves:
            origem = data.get("origem_jogadas") if isinstance(data, dict) else None
            return moves, origem or "cache_hardware"
    return [], None

def _gerar_cache_sintetico(backend: str, tamanho_tabuleiro: int) -> list:
    bits_por_eixo = int(math.log2(tamanho_tabuleiro))
    moves = [
        f"{linha:0{bits_por_eixo}b}{coluna:0{bits_por_eixo}b}"
        for linha in range(tamanho_tabuleiro)
        for coluna in range(tamanho_tabuleiro)
    ]
    random.shuffle(moves)
    cache = {
        "hardware": backend,
        "tamanho_tabuleiro": tamanho_tabuleiro,
        "origem_jogadas": "simulador_cache_v0",
        "moves": moves,
    }
    _s3_put_json(_cache_key(backend, tamanho_tabuleiro), cache)
    return _normalize_moves(cache, tamanho_tabuleiro)

def _normalize_moves(data, tamanho):
    if isinstance(data, dict):
        data = data.get("data", data)
        if isinstance(data, dict):
            data = data.get(f"tamanho_tabuleiro_{tamanho}", data.get("moves", data.get("dados_randomicos_gerados", [])))
    if not isinstance(data, list):
        return []
    bits = math.ceil(math.log2(tamanho))
    moves = []
    seen = set()
    for value in data:
        if isinstance(value, dict):
            coord = value.get("coordenada", {})
            linha, coluna = coord.get("x"), coord.get("y")
            if not isinstance(linha, int) or not isinstance(coluna, int):
                continue
        elif isinstance(value, str):
            value = value.strip().upper()
            if len(value) == 2 * bits and set(value) <= {"0", "1"}:
                linha, coluna = int(value[:bits], 2), int(value[bits:], 2)
            elif len(value) >= 2 and value[0].isalpha() and value[1:].isdigit():
                linha, coluna = ord(value[0]) - ord("A"), int(value[1:]) - 1
            else:
                continue
        else:
            continue
        if 0 <= linha < tamanho and 0 <= coluna < tamanho:
            move = coord_para_letra_numero(linha, coluna)
            if move not in seen:
                seen.add(move)
                moves.append(move)
    return moves

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
        "codigo_secreto": game.codigo_secreto,
        "navios_jogador": game.navios_jogador,
        "navios_quantico": game.navios_quantico,
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
    game = Jogo.__new__(Jogo)
    game.tamanho_tabuleiro = int(state["tamanho_tabuleiro"])
    game.num_navios = int(state["num_navios"])
    game.pilha_ataques_quanticos = list(state.get("pilha", []))
    game.codigo_secreto = state.get("codigo_secreto", "")
    game.tabuleiro_jogador = state["tabuleiro_jogador"]
    if state.get("tabuleiro_quantico") is not None:
        game.tabuleiro_quantico = state["tabuleiro_quantico"]
    game.vez_do_jogador = state.get("vez_do_jogador", True)
    return game

def coord_para_letra_numero(linha, coluna):
    return f"{chr(ord('A') + int(linha))}{coluna + 1}"

def _frota_adversaria(state, lado="quantico"):
    navios = state.get(f"navios_{lado}")
    if navios is None:
        return None
    tabuleiro = state[f"tabuleiro_{lado}"]
    return [
        {
            "id": f"navio_{indice + 1}",
            "tamanho": len(navio),
            "afundado": all(tabuleiro[int(linha)][int(coluna)] == 2 for linha, coluna in navio),
        }
        for indice, navio in enumerate(navios)
    ]

def _ataque_computador(state, game):
    chip = state.setdefault("chip_classico", {"ativo": False, "alvo": None, "acertos": []})
    fonte = "quantico"
    if state["meta"].get("dificuldade") == "plus" and chip["ativo"]:
        fonte = "classico"
        acertos = [[int(row), int(col)] for row, col in chip["acertos"]]
        horizontal = len(acertos) > 1 and len({row for row, col in acertos}) == 1
        vertical = len(acertos) > 1 and len({col for row, col in acertos}) == 1
        direcoes = [(0, -1), (0, 1)] if horizontal else [(-1, 0), (1, 0)] if vertical else [(-1, 0), (0, 1), (1, 0), (0, -1)]
        candidatos = []
        for row, col in acertos:
            for delta_row, delta_col in direcoes:
                vizinho = [row + delta_row, col + delta_col]
                if all(0 <= valor < game.tamanho_tabuleiro for valor in vizinho) and game.tabuleiro_jogador[vizinho[0]][vizinho[1]] in (0, 1) and vizinho not in candidatos:
                    candidatos.append(vizinho)
        if not candidatos:
            raise RuntimeError("Alvo clássico ativo sem vizinhos disponíveis")
        linha, coluna = candidatos[0]
        acertou = game.performar_ataque(linha, coluna, game.tabuleiro_jogador)
        finalizado = game.verificar_condicao_finalizacao(game.tabuleiro_jogador)
        game.vez_do_jogador = not acertou
        resultado = (finalizado, "Jogo finalizado! O computador venceu!", acertou, linha, coluna)
    else:
        resultado = game.ataque_quantico()
        finalizado, mensagem, acertou, linha, coluna = resultado
    afundado = False
    if acertou and state["meta"].get("dificuldade") == "plus":
        navios = state.get("navios_jogador", [])
        if not chip["ativo"]:
            alvo = next((indice for indice, navio in enumerate(navios) if [linha, coluna] in navio), None)
            if alvo is not None:
                acertos_conhecidos = [[int(row), int(col)] for row, col in navios[alvo] if game.tabuleiro_jogador[int(row)][int(col)] == 2]
                chip.update(ativo=True, alvo=alvo, acertos=acertos_conhecidos)
        if chip["ativo"]:
            alvo = navios[int(chip["alvo"])]
            if [linha, coluna] in alvo and [linha, coluna] not in chip["acertos"]:
                chip["acertos"].append([linha, coluna])
            afundado = all(game.tabuleiro_jogador[int(row)][int(col)] == 2 for row, col in alvo)
            if afundado:
                chip.update(ativo=False, alvo=None, acertos=[])
    return resultado, fonte, afundado

def _circuito_partida(tamanho, modo):
    bits = int(math.log2(tamanho))
    return {
        "modelo": "Hadamard independente + medição na base computacional",
        "qubits_por_eixo": bits,
        "qubits_total": 2 * bits,
        "ordem_bits": "linha | coluna (mais significativo primeiro)",
        "probabilidade_celula": f"1/{tamanho * tamanho}",
        "origem": "Dados sintéticos · v0" if modo == "simulador" else "Cache · circuito de referência, execução não verificada",
        "execucao_qpu": False,
    }

def _analise_medicoes(medicoes, tamanho):
    if not medicoes:
        return {"disponivel": False, "motivo": "Cache legado sem medições brutas ordenadas; ataques filtrados não permitem avaliar aleatoriedade."}
    possibilidades = tamanho * tamanho
    frequencias = [0] * possibilidades
    valores = [int(bits, 2) for bits in medicoes]
    for valor in valores:
        frequencias[valor] += 1
    amostras = len(valores)
    esperado = amostras / possibilidades
    chi2 = sum((freq - esperado) ** 2 / esperado for freq in frequencias)
    entropia = -sum((freq / amostras) * math.log2(freq / amostras) for freq in frequencias if freq)
    anteriores, seguintes = valores[:-1], valores[1:]
    media_anterior = sum(anteriores) / len(anteriores) if anteriores else 0
    media_seguinte = sum(seguintes) / len(seguintes) if seguintes else 0
    variancia_anterior = sum((valor - media_anterior) ** 2 for valor in anteriores)
    variancia_seguinte = sum((valor - media_seguinte) ** 2 for valor in seguintes)
    denominador = math.sqrt(variancia_anterior * variancia_seguinte)
    correlacao = sum((antes - media_anterior) * (depois - media_seguinte) for antes, depois in zip(anteriores, seguintes)) / denominador if denominador else None
    return {
        "disponivel": True,
        "base": "Todas as medições brutas, incluindo repetições; não os ataques únicos",
        "amostras": amostras,
        "frequencias": frequencias,
        "esperado_por_celula": esperado,
        "celulas_observadas": sum(freq > 0 for freq in frequencias),
        "repeticoes": amostras - sum(freq > 0 for freq in frequencias),
        "qui_quadrado": chi2,
        "graus_liberdade": possibilidades - 1,
        "aproximacao_chi2_adequada": esperado >= 5,
        "entropia_bits": entropia,
        "entropia_maxima_bits": math.log2(possibilidades),
        "correlacao_lag_1": correlacao,
        "nota": "Indicadores descritivos, sem p-valor ou certificação de aleatoriedade quântica. Lote gerado inteiro, não apenas medições consumidas na partida.",
    }

def _resumo_partida(state):
    meta = state["meta"]
    historico = meta.get("historico", [])
    ended_at = meta.get("ended_at") or _now_iso()
    fim = datetime.fromisoformat(ended_at).timestamp()
    def estatisticas(tipo, tabuleiro, navios):
        ataques = [ataque for ataque in historico if (ataque["tipo"] == tipo or tipo == "ataque_quantico" and ataque["tipo"] == "ataque_classico") and ataque.get("linha") is not None]
        acertos = sum(bool(ataque["acertou"]) for ataque in ataques)
        return {
            "jogadas": len(ataques),
            "acertos": acertos,
            "erros": len(ataques) - acertos,
            "navios_afundados": sum(all(tabuleiro[int(linha)][int(coluna)] == 2 for linha, coluna in navio) for navio in navios) if navios is not None else None,
        }
    duracao_segundos = max(0, int(fim - int(meta["created_at"])))
    estatisticas_jogador = estatisticas("ataque_jogador", state["tabuleiro_quantico"], state.get("navios_quantico"))
    estatisticas_computador = estatisticas("ataque_quantico", state["tabuleiro_jogador"], state.get("navios_jogador"))
    frota_alvo = state.get("navios_quantico")
    jogadas_minimas = sum(len(navio) for navio in frota_alvo) if frota_alvo is not None else None
    vitoria_normal = meta.get("vencedor") == "jogador" and not meta.get("vitoria_por_codigo")
    bonus_tempo = max(0, (BONUS_TEMPO_LIMITE_SEGUNDOS - duracao_segundos) // 10) if vitoria_normal else 0
    penalidade_jogadas = (
        max(0, estatisticas_jogador["jogadas"] - jogadas_minimas) * PENALIDADE_JOGADA_EXTRA
        if vitoria_normal and jogadas_minimas is not None else 0
    )
    pontuacao = max(0, estatisticas_jogador["acertos"] + bonus_tempo - penalidade_jogadas)
    return {
        "partida_id": meta.get("partida_id"),
        "jogador": meta.get("jogador_nome", meta.get("jogador", "")),
        "backend": meta.get("backend"),
        "modo": meta.get("modo", "cache"),
        "origem_jogadas": meta.get("origem_jogadas", "cache_hardware"),
        "dificuldade": meta.get("dificuldade", "normal"),
        "pontuacao": pontuacao,
        "bonus_tempo": bonus_tempo,
        "penalidade_jogadas": penalidade_jogadas,
        "jogadas_minimas": jogadas_minimas,
        "ataques_por_fonte": {fonte: sum(ataque["tipo"] == tipo and ataque.get("linha") is not None for ataque in historico) for fonte, tipo in [("quantico", "ataque_quantico"), ("classico", "ataque_classico")]},
        "vencedor": meta.get("vencedor"),
        "inicio": datetime.fromtimestamp(int(meta["created_at"]), timezone.utc).isoformat(),
        "fim": ended_at,
        "duracao_segundos": duracao_segundos,
        "tamanho_tabuleiro": state["tamanho_tabuleiro"],
        "num_navios": state["num_navios"],
        "estatisticas": {
            "jogador": estatisticas_jogador,
            "computador": estatisticas_computador,
        },
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "tabuleiro_quantico": state["tabuleiro_quantico"],
        "historico": historico,
        "frota_adversaria": _frota_adversaria(state),
        "frota_jogador": _frota_adversaria(state, "jogador"),
        "circuito": meta.get("circuito"),
        "medicoes_brutas": meta.get("medicoes_brutas", []),
        "analise": _analise_medicoes(meta.get("medicoes_brutas", []), int(state["tamanho_tabuleiro"])),
    }

# ----------------------------
# Rotas 
# ----------------------------
def handle_iniciar(event):
    body = _parse_json_body(event)

    try:
        num_navios = int(str(body.get("num_navios", 4)).strip())
        tamanho_tabuleiro = int(str(body.get("tamanho_tabuleiro", 8)).strip())
    except (ValueError, TypeError):
        return _resp(400, {"error": "Informe tamanho e quantidade de navios inteiros."})

    if tamanho_tabuleiro not in (4, 8, 16):
        return _resp(400, {"error": "Escolha um tabuleiro 4×4, 8×8 ou 16×16."})
    if not 1 <= num_navios <= tamanho_tabuleiro:
        return _resp(400, {"error": "A quantidade de navios deve ser de 1 até o tamanho do tabuleiro."})

    jogador = (body.get("nome") or "").strip()
    dificuldade = body.get("dificuldade", "normal")
    if dificuldade not in ("normal", "plus"):
        return _resp(400, {"error": "Dificuldade inválida."})
    modo = body.get("modo", "cache")
    if modo not in ("simulador", "cache"):
        return _resp(400, {"error": "Modo inválido."})
    backend = body.get("backend") or "simulador"
    if modo == "cache" and backend not in HARDWARE_FILES:
        return _resp(400, {"error": "Selecione um hardware para usar o cache."})

    # 1) tenta carregar cache primeiro
    medicoes = []
    origem_jogadas = "simulador_v0"
    if modo == "simulador":
        bits = 2 * int(math.log2(tamanho_tabuleiro))
        medicoes = [format(random.getrandbits(bits), f"0{bits}b") for _ in range(32 * tamanho_tabuleiro * tamanho_tabuleiro)]
        pilha = _normalize_moves(medicoes, tamanho_tabuleiro)
    else:
        pilha, origem_jogadas = _load_moves_from_s3_with_source(backend, tamanho_tabuleiro)
        if not pilha:
            pilha = _gerar_cache_sintetico(backend, tamanho_tabuleiro)
            origem_jogadas = "simulador_cache_v0"

    # 2) cache sintético de teste já foi gerado se não havia cache
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

    ranking = _ranking_global()
    fila_espera = []

    meta = {
        "partida_id": game_id,
        "dificuldade": dificuldade,
        "jogador_id": _player_id_from_name(jogador),
        "jogador_nome": jogador,
        "modo": modo,
        "origem_jogadas": origem_jogadas,
        "circuito": _circuito_partida(tamanho_tabuleiro, modo),
        "medicoes_brutas": medicoes,
        "placar": {"jogador": 0, "computador": 0},
        "historico": [],
        "em_andamento": True,
        "jogador": jogador,
        "backend": backend,
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
        "circuito": meta["circuito"],
        "modo": modo,
        "game_id": game_id,
        "backend": backend,
        "origem_jogadas": origem_jogadas,
        "tamanho_tabuleiro": tamanho_tabuleiro,
        "ranking": ranking,
        "fila_espera": fila_espera,
        "pilha_len": len(pilha),
        "tabuleiro_jogador": game.tabuleiro_jogador,
        "frota_adversaria": _frota_adversaria(state),
        "frota_jogador": _frota_adversaria(state, "jogador"),
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

    if not game.vez_do_jogador:
        return _resp(409, {"error": "Aguarde o ataque do computador."})
    vitoria_por_codigo = game.verificar_codigo_secreto(coordenada)
    if not vitoria_por_codigo:
        if not game.validar_coordenada(coordenada):
            return _resp(400, {"error": "Coordenada inválida."})
        linha, coluna = game.recupera_coordenada(coordenada)
        if not game.validar_coordenada_repetida(linha, coluna, game.tabuleiro_quantico):
            return _resp(409, {"error": "Coordenada repetida."})

    frota_anterior = _frota_adversaria(state)
    finalizado, _msg, acertou, linha, coluna = game.ataque_jogador(coordenada)
    frota = _frota_adversaria(state)
    navio_afundado = None
    if acertou and frota is not None:
        for indice, navio in enumerate(frota):
            if navio["afundado"] and not frota_anterior[indice]["afundado"]:
                navio_afundado = {
                    **navio,
                    "coordenadas": [coord_para_letra_numero(int(linha_navio), int(coluna_navio)) for linha_navio, coluna_navio in state["navios_quantico"][indice]],
                }
                break

    # mensagem
    if finalizado:
        mensagem = "Jogo finalizado! Você venceu!"
        state["meta"]["em_andamento"] = False
        state["meta"]["ended_at"] = _now_iso()
        state["meta"]["vitoria_por_codigo"] = vitoria_por_codigo
        vencedor = "jogador"
    else:
        mensagem = f"Ataque do jogador em {coordenada.upper()} → {'Acertou!' if acertou else 'Errou!'}"
        vencedor = None
        if navio_afundado:
            mensagem += f" Navio de {navio_afundado['tamanho']} posições afundado!"

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
        "frota_adversaria": frota,
        "navio_afundado": navio_afundado,
        "vez_do_jogador": state["vez_do_jogador"],
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "finalizado": bool(finalizado),
        "tabuleiro_quantico": state["tabuleiro_quantico"] if finalizado else None,
        "resumo": _resumo_partida(state) if finalizado else None,
        "ranking": _ranking_global() if finalizado else None,
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
    if game.vez_do_jogador:
        return _resp(409, {"error": "Agora é a vez do jogador."})

    resultado, fonte, navio_afundado = _ataque_computador(state, game)
    finalizado, _msg, acertou, linha, coluna = resultado

    if finalizado:
        mensagem = _msg
        state["meta"]["em_andamento"] = False
        state["meta"]["ended_at"] = _now_iso()
        vencedor = "computador" if game.verificar_condicao_finalizacao(game.tabuleiro_jogador) else "sem_jogadas"
    else:
        mensagem = f"Ataque {'clássico' if fonte == 'classico' else 'quântico'} em {coord_para_letra_numero(linha, coluna)} → {'Acertou!' if acertou else 'Errou!'}"
        if navio_afundado:
            mensagem += " Navio afundado. Chip quântico retomado."
        vencedor = None

    if acertou:
        state["meta"]["placar"]["computador"] = int(state["meta"]["placar"].get("computador", 0)) + 1

    state["meta"]["historico"].append({
        "t": _now_iso(),
        "tipo": "ataque_classico" if fonte == "classico" else "ataque_quantico",
        "coord": coord_para_letra_numero(linha, coluna) if linha is not None else None,
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
        "frota_jogador": _frota_adversaria(state, "jogador"),
        "fonte_ataque": fonte,
        "chip_classico_ativo": state.get("chip_classico", {}).get("ativo", False),
        "status": "acerto" if acertou else "erro",
        "mensagem": mensagem,
        "vez_do_jogador": state["vez_do_jogador"],
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "finalizado": bool(finalizado),
        "tabuleiro_quantico": state["tabuleiro_quantico"] if finalizado else None,
        "resumo": _resumo_partida(state) if finalizado else None,
        "ranking": _ranking_global() if finalizado else None,
    })

def handle_encerrar(event):
    body = _parse_json_body(event)
    game_id = _get_game_id(event, body)
    if not game_id:
        return _resp(400, {"error": "Missing game_id"})

    # opção 1: marca encerrado
    state = _dynamo_get_game(game_id)
    if state:
        meta = state.setdefault("meta", {})
        if meta.get("em_andamento", state.get("em_andamento", False)):
            meta["vencedor"] = meta.get("vencedor") or "abandonada"
            meta["ended_at"] = meta.get("ended_at") or _now_iso()
        state["em_andamento"] = False
        meta["em_andamento"] = False
        _dynamo_put_game(game_id, state)
        _persist_partida_e_jogador_no_s3(state)

    # opção 2 (mais “cache-like”): apaga o item
    # _dynamo_delete_game(game_id)

    return _resp(200, {
        "status": "jogo encerrado",
        "pontuacao": _resumo_partida(state)["pontuacao"] if state else 0,
        "ranking": _ranking_global(),
    })

def _persist_partida_e_jogador_no_s3(state: dict):
    if not CACHE_BUCKET:
        return

    meta = state.get("meta", {})
    partida_id = meta.get("partida_id") or state.get("game_id") or str(uuid.uuid4())
    jogador_id = meta.get("jogador_id") or "jogador_anon"
    resumo = _resumo_partida(state)

    # 1) salva a partida completa
    partida_key = f"{MATCH_PREFIX}{partida_id}.json"
    partida_doc = {
        "partida_id": partida_id,
        "resumo": resumo,
        "pontuacao": resumo["pontuacao"],
        "modo": meta.get("modo", "cache"),
        "origem_jogadas": meta.get("origem_jogadas", "cache_hardware"),
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
            "partidas": [],
        }

    backend = meta.get("backend")
    hardwares = jogador_doc.setdefault("hardwares_jogados", [])
    if backend and backend not in hardwares:
        hardwares.append(backend)

    pontos_partida = resumo["pontuacao"]
    partidas = jogador_doc.setdefault("partidas", [])
    if not isinstance(partidas, list):
        partidas = []
        jogador_doc["partidas"] = partidas
    if not any(partida.get("id_partida") == partida_id for partida in partidas):
        pontuacao_global = jogador_doc.setdefault("pontuacao_global", {})
        pontuacao_global["pontos_totais"] = int(pontuacao_global.get("pontos_totais", 0)) + pontos_partida
        pontuacao_global["melhor_pontuacao_partida"] = max(
            int(pontuacao_global.get("melhor_pontuacao_partida", 0)),
            pontos_partida,
        )
        pontuacao_global["partidas"] = int(pontuacao_global.get("partidas", 0)) + 1

        venceu = meta.get("vencedor") == "jogador"
        if meta.get("vencedor") in ("jogador", "computador"):
            resultado = "vitorias" if venceu else "derrotas"
            pontuacao_global[resultado] = int(pontuacao_global.get(resultado, 0)) + 1

        partidas.append({
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
        return _resp(200, {"ranking": _ranking_global(), "fila_espera": [], "em_andamento": False})

    state = _dynamo_get_game(game_id)
    if not state:
        return _resp(404, {"error": "Jogo não encontrado."})

    return _resp(200, {
        "ranking": _ranking_global(),
        "fila_espera": state.get("fila_espera", []),
        "em_andamento": state.get("meta", {}).get("em_andamento", False),
        "tamanho_tabuleiro": state["tamanho_tabuleiro"],
        "tabuleiro_jogador": state["tabuleiro_jogador"],
        "ataques_jogador": [[cell if cell in (2, 3) else 0 for cell in row] for row in state["tabuleiro_quantico"]],
        "frota_adversaria": _frota_adversaria(state),
        "frota_jogador": _frota_adversaria(state, "jogador"),
        "vez_do_jogador": state["vez_do_jogador"],
        "placar": state["meta"].get("placar", {}),
        "circuito": state["meta"].get("circuito"),
        "dificuldade": state["meta"].get("dificuldade", "normal"),
        "chip_classico_ativo": state.get("chip_classico", {}).get("ativo", False),
        "resumo": _resumo_partida(state) if state["meta"].get("vencedor") else None,
        "backend": state.get("backend", ""),
        "jogador": state.get("jogador", ""),
    })

def handle_analises(event):
    qs = event.get("queryStringParameters") or {}
    hardware = (qs.get("hardware") or "").strip()
    tamanho_raw = qs.get("tamanho_tabuleiro")

    if not CACHE_BUCKET:
        return _resp(200, {"hardwares": [], "partidas": [], "analise": {"disponivel": False, "motivo": "Armazenamento de partidas indisponível."}})

    try:
        partidas = _listar_partidas_s3()
    except Exception as erro:
        logger.exception("Falha ao listar partidas para análise")
        return _resp(500, {"error": "Não foi possível carregar as partidas arquivadas."})

    contagem = {}
    simuladas_por_hardware = {}
    for partida in partidas:
        hw = partida.get("backend")
        if hw in HARDWARE_FILES:
            contagem[hw] = contagem.get(hw, 0) + 1
            if partida.get("modo", "cache") == "simulador":
                simuladas_por_hardware[hw] = simuladas_por_hardware.get(hw, 0) + 1
    hardwares = [
        {"id": hw, "nome": hw, "partidas": contagem.get(hw, 0), "partidas_modo_simulador": simuladas_por_hardware.get(hw, 0)}
        for hw in sorted(HARDWARE_FILES)
    ]

    if not hardware:
        return _resp(200, {"hardwares": hardwares})
    if hardware not in HARDWARE_FILES:
        return _resp(400, {"error": "Selecione um computador quântico listado."})
    if tamanho_raw is None:
        return _resp(400, {"error": "Informe o tamanho_tabuleiro ou use 'todos' para uma análise conjunta."})
    todos_tamanhos = str(tamanho_raw).strip().lower() in ("todos", "all")
    if todos_tamanhos:
        hardware_partidas = [partida for partida in partidas if partida.get("backend") == hardware]
        partidas_modo_simulador = sum(partida.get("modo", "cache") == "simulador" for partida in hardware_partidas)
        return _resp(200, _analise_conjunta_partidas(hardware, hardware_partidas, len(hardware_partidas), partidas_modo_simulador))
    try:
        tamanho = int(tamanho_raw)
    except (ValueError, TypeError):
        return _resp(400, {"error": "tamanho_tabuleiro deve ser 4, 8 ou 16."})
    if tamanho not in (4, 8, 16):
        return _resp(400, {"error": "tamanho_tabuleiro deve ser 4, 8 ou 16."})

    hardware_partidas = [
        partida for partida in partidas
        if partida.get("backend") == hardware and int(partida.get("tamanho_tabuleiro") or 0) == tamanho
    ]
    partidas_modo_simulador = sum(partida.get("modo", "cache") == "simulador" for partida in hardware_partidas)
    selecionadas = hardware_partidas
    bits_por_eixo = int(math.log2(tamanho))
    qubits = bits_por_eixo * 2
    bitstrings = []
    partidas_resumo = []
    correlacoes = []
    classicas_excluidas = 0

    for partida in selecionadas:
        historico = partida.get("historico") or []
        ataques_quanticos = []
        ataques_classicos = 0
        for ataque in historico:
            tipo = ataque.get("tipo")
            if tipo == "ataque_classico":
                ataques_classicos += 1
                continue
            if tipo != "ataque_quantico":
                continue
            try:
                linha = int(ataque["linha"])
                coluna = int(ataque["coluna"])
            except (KeyError, TypeError, ValueError):
                continue
            if not (0 <= linha < tamanho and 0 <= coluna < tamanho):
                continue
            ataques_quanticos.append({
                "bits": f"{linha:0{bits_por_eixo}b}{coluna:0{bits_por_eixo}b}",
                "t": ataque.get("t") or "",
                "acertou": bool(ataque.get("acertou")),
            })
        ataques_quanticos.sort(key=lambda ataque: ataque["t"])
        amostras_partida = [ataque["bits"] for ataque in ataques_quanticos]
        bitstrings.extend(amostras_partida)
        classicas_excluidas += ataques_classicos

        resumo = partida.get("resumo") or {}
        partidas_resumo.append({
            "id": partida.get("partida_id") or resumo.get("partida_id"),
            "data": partida.get("ended_at") or resumo.get("fim") or "",
            "hardware": partida.get("backend"),
            "origem_jogadas": partida.get("origem_jogadas") or resumo.get("origem_jogadas") or "cache_hardware",
            "jogador": (partida.get("jogador") or {}).get("nome") or resumo.get("jogador") or "Jogador",
            "modo": partida.get("modo") or resumo.get("modo") or "cache",
            "vencedor": partida.get("vencedor") or resumo.get("vencedor"),
            "pontuacao": int(partida.get("pontuacao", resumo.get("pontuacao", 0)) or 0),
            "ataques_quanticos": len(ataques_quanticos),
            "acertos": sum(ataque["acertou"] for ataque in ataques_quanticos),
            "ataques_classicos": ataques_classicos,
            "incluida": bool(ataques_quanticos),
        })
        if amostras_partida:
            correlacao = _analise_medicoes(amostras_partida, tamanho).get("correlacao_lag_1")
            if correlacao is not None and math.isfinite(correlacao):
                correlacoes.append((correlacao, max(1, len(amostras_partida) - 1)))

    if bitstrings:
        analise = _analise_medicoes(bitstrings, tamanho)
        frequencias_observadas = analise["frequencias"]
        probabilidades = [frequencia / len(bitstrings) for frequencia in frequencias_observadas]
        frequencia_bits = [sum(bits[indice] == "1" for bits in bitstrings) / len(bitstrings) for indice in range(qubits)]
        analise.update({
            "base": "Ataques quânticos reais registrados nas partidas concluídas; ataques clássicos excluídos.",
            "frequencia_bit_1_por_qubit": frequencia_bits,
            "entropia_por_qubit": [
                -p * math.log2(p) - (1 - p) * math.log2(1 - p) if 0 < p < 1 else 0
                for p in frequencia_bits
            ],
            "min_entropia_empirica_bits": -math.log2(max(probabilidades)) if max(probabilidades) else None,
            "entropia_colisao_empirica_bits": -math.log2(sum(probabilidade ** 2 for probabilidade in probabilidades)) if any(probabilidades) else None,
            "hamming": [sum(bits.count("1") == peso for bits in bitstrings) for peso in range(qubits + 1)],
            "correlacao_lag_1": (
                sum(valor * peso for valor, peso in correlacoes) / sum(peso for _, peso in correlacoes)
                if correlacoes else None
            ),
            "nota": "Índices descritivos das jogadas registradas; não certificam aleatoriedade quântica. A correlação é calculada dentro de cada partida.",
        })
    else:
        analise = {"disponivel": False, "motivo": "Nenhuma jogada quântica arquivada para este hardware e tamanho de tabuleiro."}

    partidas_resumo.sort(key=lambda partida: partida["data"], reverse=True)
    return _resp(200, {
        "hardware": hardware,
        "tamanho_tabuleiro": tamanho,
        "qubits_total": qubits,
        "amostras": len(bitstrings),
        "partidas_total": len(hardware_partidas),
        "partidas_analisadas": sum(partida["incluida"] for partida in partidas_resumo),
        "partidas_modo_simulador": partidas_modo_simulador,
        "ataques_classicos_excluidos": classicas_excluidas,
        "xeb": {
            "disponivel": False,
            "motivo": "O jogo usa um circuito Hadamard com saída uniforme e não arquiva probabilidades ideais p_C(x) por circuito; XEB do artigo não é informativo nem calculável para estes dados.",
        },
        "tqc": {
            "disponivel": False,
            "motivo": "Os arquivos guardam horário da jogada, não duração de execução/resposta do QPU.",
        },
        "entropia_certificada": {
            "disponivel": False,
            "motivo": "Min-entropia suave certificada exige XEB verificável, limiar, modelo de adversário e extractor; as entropias empíricas abaixo são descritivas.",
        },
        "partidas": partidas_resumo,
        "analise": analise,
    })

def _analise_conjunta_partidas(hardware: str, selecionadas: list, partidas_total: int, partidas_modo_simulador: int) -> dict:
    por_tamanho = {4: [], 8: [], 16: []}
    partidas_resumo = []
    ataques_classicos_excluidos = 0
    frequencias_celulas = [0] * 256
    esperadas_celulas = [0.0] * 256
    frequencias_linhas = [0] * 16
    frequencias_colunas = [0] * 16
    esperadas_linhas = [0.0] * 16
    esperadas_colunas = [0.0] * 16
    hamming_normalizado = [0] * 9
    amostras = 0

    for partida in selecionadas:
        try:
            tamanho = int(partida.get("tamanho_tabuleiro") or 0)
        except (TypeError, ValueError):
            continue
        if tamanho not in por_tamanho:
            continue
        bits_por_eixo = int(math.log2(tamanho))
        historico = partida.get("historico") or []
        ataques = []
        classicas = 0
        for ataque in historico:
            if ataque.get("tipo") == "ataque_classico":
                classicas += 1
                continue
            if ataque.get("tipo") != "ataque_quantico":
                continue
            try:
                linha = int(ataque["linha"])
                coluna = int(ataque["coluna"])
            except (KeyError, TypeError, ValueError):
                continue
            if not (0 <= linha < tamanho and 0 <= coluna < tamanho):
                continue
            ataques.append({
                "linha": linha,
                "coluna": coluna,
                "bits": f"{linha:0{bits_por_eixo}b}{coluna:0{bits_por_eixo}b}",
                "t": ataque.get("t") or "",
                "acertou": bool(ataque.get("acertou")),
            })
        ataques.sort(key=lambda ataque: ataque["t"])
        por_tamanho[tamanho].extend(ataque["bits"] for ataque in ataques)
        ataques_classicos_excluidos += classicas
        amostras += len(ataques)

        esperado_por_casa = len(ataques) / (tamanho * tamanho) if ataques else 0
        esperado_por_linha = len(ataques) / tamanho if ataques else 0
        for linha in range(tamanho):
            linha_normalizada = linha * 16 // tamanho
            esperadas_linhas[linha_normalizada] += esperado_por_linha
            for coluna in range(tamanho):
                coluna_normalizada = coluna * 16 // tamanho
                esperadas_celulas[linha_normalizada * 16 + coluna_normalizada] += esperado_por_casa
        for coluna in range(tamanho):
            esperadas_colunas[coluna * 16 // tamanho] += esperado_por_linha

        for ataque in ataques:
            linha_normalizada = ataque["linha"] * 16 // tamanho
            coluna_normalizada = ataque["coluna"] * 16 // tamanho
            frequencias_celulas[linha_normalizada * 16 + coluna_normalizada] += 1
            frequencias_linhas[linha_normalizada] += 1
            frequencias_colunas[coluna_normalizada] += 1
            peso = ataque["bits"].count("1")
            qubits = bits_por_eixo * 2
            faixa_hamming = round((peso / qubits) * 8)
            hamming_normalizado[faixa_hamming] += 1

        resumo = partida.get("resumo") or {}
        partidas_resumo.append({
            "id": partida.get("partida_id") or resumo.get("partida_id"),
            "data": partida.get("ended_at") or resumo.get("fim") or "",
            "hardware": partida.get("backend"),
            "origem_jogadas": partida.get("origem_jogadas") or resumo.get("origem_jogadas") or "cache_hardware",
            "jogador": (partida.get("jogador") or {}).get("nome") or resumo.get("jogador") or "Jogador",
            "modo": partida.get("modo") or resumo.get("modo") or "cache",
            "vencedor": partida.get("vencedor") or resumo.get("vencedor"),
            "pontuacao": int(partida.get("pontuacao", resumo.get("pontuacao", 0)) or 0),
            "tamanho_tabuleiro": tamanho,
            "ataques_quanticos": len(ataques),
            "acertos": sum(ataque["acertou"] for ataque in ataques),
            "ataques_classicos": classicas,
            "incluida": bool(ataques),
        })

    if amostras:
        probabilidades = [frequencia / amostras for frequencia in frequencias_celulas if frequencia]
        probabilidades_esperadas = [frequencia / amostras for frequencia in esperadas_celulas if frequencia]
        entropia = -sum(probabilidade * math.log2(probabilidade) for probabilidade in probabilidades)
        entropia_esperada = -sum(probabilidade * math.log2(probabilidade) for probabilidade in probabilidades_esperadas if probabilidade)
        chi2 = sum(
            (observada - esperada) ** 2 / esperada
            for observada, esperada in zip(frequencias_celulas, esperadas_celulas)
            if esperada > 0
        )
        analise_por_tamanho = []
        for tamanho, bitstrings in por_tamanho.items():
            if not bitstrings:
                continue
            analise_tamanho = _analise_medicoes(bitstrings, tamanho)
            max_entropia = math.log2(tamanho * tamanho)
            analise_por_tamanho.append({
                "tamanho_tabuleiro": tamanho,
                "amostras": len(bitstrings),
                "entropia_bits": analise_tamanho["entropia_bits"],
                "entropia_normalizada": analise_tamanho["entropia_bits"] / max_entropia if max_entropia else 0,
                "min_entropia_empirica_bits": -math.log2(max(analise_tamanho["frequencias"]) / len(bitstrings)),
                "chi2_por_grau_liberdade": analise_tamanho["qui_quadrado"] / analise_tamanho["graus_liberdade"] if analise_tamanho["graus_liberdade"] else None,
            })
        analise_por_tamanho.sort(key=lambda item: item["tamanho_tabuleiro"])
        analise = {
            "disponivel": True,
            "conjunta": True,
            "amostras": amostras,
            "entropia_bits": entropia,
            "entropia_esperada_bits": entropia_esperada,
            "entropia_normalizada": entropia / entropia_esperada if entropia_esperada else 0,
            "min_entropia_empirica_bits": -math.log2(max(frequencias_celulas) / amostras),
            "qui_quadrado": chi2,
            "graus_liberdade": sum(esperada > 0 for esperada in esperadas_celulas) - 1,
            "hamming_normalizado": hamming_normalizado,
            "frequencia_linha_normalizada": frequencias_linhas,
            "esperada_linha_normalizada": esperadas_linhas,
            "frequencia_coluna_normalizada": frequencias_colunas,
            "esperada_coluna_normalizada": esperadas_colunas,
            "entropia_por_tabuleiro": analise_por_tamanho,
            "baseline": "Mistura ponderada pelo número de ataques: cada tabuleiro usa uniforme apenas entre suas próprias casas, mapeadas em coordenadas relativas 16×16.",
            "nota": "Índices empíricos normalizados; não são XEB nem certificam aleatoriedade quântica.",
        }
    else:
        analise = {"disponivel": False, "conjunta": True, "motivo": "Nenhuma jogada quântica arquivada para este hardware."}

    partidas_resumo.sort(key=lambda partida: partida["data"], reverse=True)
    return {
        "hardware": hardware,
        "tamanho_tabuleiro": "todos",
        "qubits_total": None,
        "amostras": amostras,
        "partidas_total": partidas_total,
        "partidas_analisadas": sum(partida["incluida"] for partida in partidas_resumo),
        "partidas_modo_simulador": partidas_modo_simulador,
        "ataques_classicos_excluidos": ataques_classicos_excluidos,
        "xeb": {
            "disponivel": False,
            "motivo": "XEB requer probabilidades ideais por circuito e não é informativo para a saída uniforme Hadamard do jogo, inclusive na mistura de tamanhos.",
        },
        "tqc": {
            "disponivel": False,
            "motivo": "Os arquivos guardam horário da jogada, não duração de execução/resposta do QPU.",
        },
        "entropia_certificada": {
            "disponivel": False,
            "motivo": "A agregação de tamanhos usa métricas normalizadas empíricas; não equivale à min-entropia suave certificada do artigo.",
        },
        "partidas": partidas_resumo,
        "analise": analise,
    }

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

def _listar_partidas_s3() -> list:
    partidas = []
    token = None
    while True:
        args = {"Bucket": CACHE_BUCKET, "Prefix": MATCH_PREFIX}
        if token:
            args["ContinuationToken"] = token
        pagina = s3.list_objects_v2(**args)
        for item in pagina.get("Contents", []):
            chave = item.get("Key", "")
            if not chave.endswith(".json"):
                continue
            try:
                partida = _s3_get_json(chave)
            except Exception:
                logger.exception("Falha ao carregar partida arquivada: %s", chave)
                continue
            if isinstance(partida, dict) and partida.get("backend"):
                partidas.append(partida)
        if pagina.get("IsTruncated") is not True:
            break
        token = pagina.get("NextContinuationToken")
        if not token:
            break
    return partidas

def _ranking_global(limite: int = 10) -> list:
    if not CACHE_BUCKET:
        return []

    jogadores = []
    token = None
    try:
        while True:
            args = {"Bucket": CACHE_BUCKET, "Prefix": PLAYER_PREFIX}
            if token:
                args["ContinuationToken"] = token
            pagina = s3.list_objects_v2(**args)
            for item in pagina.get("Contents", []):
                chave = item.get("Key", "")
                if not chave.endswith(".json"):
                    continue
                try:
                    jogador = _s3_get_json(chave)
                except Exception:
                    logger.exception("Falha ao carregar jogador do ranking: %s", chave)
                    continue
                if not isinstance(jogador, dict):
                    continue
                pontuacao = jogador.get("pontuacao_global") or {}
                jogadores.append({
                    "nome": jogador.get("nome") or "Jogador",
                    "pontos": int(pontuacao.get("pontos_totais", 0)),
                })
            if pagina.get("IsTruncated") is not True:
                break
            token = pagina.get("NextContinuationToken")
            if not token:
                break
    except Exception:
        logger.exception("Falha ao montar ranking global do S3")
        return []

    jogadores.sort(key=lambda jogador: (-jogador["pontos"], jogador["nome"].casefold()))
    return jogadores[:limite]

def _s3_put_json(key: str, data: dict):
    s3.put_object(
        Bucket=CACHE_BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False, default=lambda value: int(value) if isinstance(value, Decimal) and value == int(value) else float(value)).encode("utf-8"),
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
    return list(HARDWARE_FILES)

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
        ("GET",  "/analises"): handle_analises,
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