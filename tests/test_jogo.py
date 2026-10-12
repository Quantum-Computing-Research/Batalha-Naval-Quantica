import copy
import importlib
import io
import json
import os
from pathlib import Path
import random
import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch


class JogoLambdaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "infra/lambda/jogo"))
        boto3 = types.ModuleType("boto3")
        boto3.resource = MagicMock()
        boto3.client = MagicMock()
        with patch.dict(sys.modules, {"boto3": boto3}), patch.dict(os.environ, {"GAME_TABLE": "test", "CACHE_BUCKET": "test"}):
            cls.handler = importlib.import_module("handler")

    def setUp(self):
        self.states = {}
        self.patches = [
            patch.object(self.handler, "_dynamo_put_game", side_effect=lambda game_id, state: self.states.update({game_id: copy.deepcopy(state)})),
            patch.object(self.handler, "_dynamo_get_game", side_effect=lambda game_id: copy.deepcopy(self.states.get(game_id))),
            patch.object(self.handler, "_persist_partida_e_jogador_no_s3"),
        ]
        for mocked in self.patches:
            mocked.start()
            self.addCleanup(mocked.stop)

    def request(self, path, body=None, game_id=None, method="POST", expected=200, query=None):
        response = self.handler.handler({
            "rawPath": path,
            "requestContext": {"http": {"method": method}},
            "body": json.dumps(body or {}),
            "headers": {"x-game-id": game_id} if game_id else {},
            "queryStringParameters": query or {},
        }, None)
        data = json.loads(response["body"])
        self.assertEqual(response["statusCode"], expected, data)
        return data

    def start_game(self, size=8, ships=4):
        return self.request("/iniciar_jogo", {"nome": "Teste", "modo": "simulador", "tamanho_tabuleiro": size, "num_navios": ships})["game_id"]

    def test_player_can_finish_every_board_size(self):
        for size in (4, 8, 16):
            with self.subTest(size=size):
                game_id = self.start_game(size)
                self.assertEqual(len(self.states[game_id]["pilha"]), size * size)
                for linha, row in enumerate(copy.deepcopy(self.states[game_id]["tabuleiro_quantico"])):
                    for coluna, cell in enumerate(row):
                        if cell == 1:
                            result = self.request("/atacar", {"coordenada": self.handler.coord_para_letra_numero(linha, coluna)}, game_id)
                self.assertTrue(result["finalizado"])
                self.assertEqual(result["resumo"]["estatisticas"]["jogador"]["navios_afundados"], 4)
                self.assertEqual(result["resumo"]["estatisticas"]["jogador"]["jogadas"], 10)
                self.assertEqual(result["resumo"]["tamanho_tabuleiro"], size)
                self.assertGreaterEqual(result["resumo"]["duracao_segundos"], 0)
                self.assertEqual(self.states[game_id]["meta"]["placar"]["jogador"], 10)
                self.request("/encerrar_jogo", game_id=game_id)
                self.request("/atacar", {"coordenada": "A1"}, game_id, expected=404)

    def test_cache_mode_generates_and_persists_mock_moves_for_selected_hardware(self):
        cache = {}
        key = "cache/rigetti_cepheus/4.json"

        def load_cache(backend, size):
            if key not in cache:
                return [], None
            return self.handler._normalize_moves(cache[key], size), cache[key]["origem_jogadas"]

        with patch.object(self.handler, "_load_moves_from_s3_with_source", side_effect=load_cache), patch.object(
            self.handler, "_s3_put_json", side_effect=lambda cache_key, document: cache.update({cache_key: document})
        ) as save_cache:
            result = self.request("/iniciar_jogo", {
                "nome": "Teste mock",
                "backend": "rigetti_cepheus",
                "modo": "cache",
                "tamanho_tabuleiro": 4,
                "num_navios": 2,
            })
            second_result = self.request("/iniciar_jogo", {
                "nome": "Teste mock 2",
                "backend": "rigetti_cepheus",
                "modo": "cache",
                "tamanho_tabuleiro": 4,
                "num_navios": 2,
            })

        self.assertFalse(result["backend_offline"])
        self.assertEqual(result["backend"], "rigetti_cepheus")
        self.assertEqual(result["modo"], "cache")
        self.assertEqual(result["origem_jogadas"], "simulador_cache_v0")
        state = self.states[result["game_id"]]
        self.assertEqual(state["meta"]["backend"], "rigetti_cepheus")
        self.assertEqual(state["meta"]["origem_jogadas"], "simulador_cache_v0")
        cache_doc = cache[key]
        self.assertEqual(len(self.handler._normalize_moves(cache_doc, 4)), 16)
        self.assertEqual(len(state["pilha"]), 16)
        self.assertEqual(second_result["origem_jogadas"], "simulador_cache_v0")
        self.assertEqual(len(self.states[second_result["game_id"]]["pilha"]), 16)
        self.assertEqual(save_cache.call_count, 1)

    def test_supported_hardware_is_available_when_mock_cache_can_be_generated(self):
        with patch.object(self.handler, "_load_moves_from_s3_with_source", return_value=([], None)), patch.object(self.handler, "_s3_exists", return_value=False):
            result = self.request("/cache", method="GET")

        rigetti = next(item for item in result["hardwares"] if item["hardware"] == "rigetti_cepheus")
        self.assertTrue(rigetti["online"])
        self.assertTrue(rigetti["cache_mock_disponivel"])
        self.assertEqual(rigetti["moves_count"], 0)

    def test_computer_turn_and_final_hit(self):
        game_id = self.start_game(8)
        state = self.states[game_id]
        self.request("/ataque-quantico", game_id=game_id, method="GET", expected=409)
        state["tabuleiro_quantico"][0][0] = 0
        self.request("/atacar", {"coordenada": "A1"}, game_id)
        self.request("/atacar", {"coordenada": "A2"}, game_id, expected=409)
        state = self.states[game_id]
        state["tabuleiro_jogador"] = [[0] * 10 for _ in range(10)]
        state["tabuleiro_jogador"][0][0] = 1
        state["pilha"] = ["Z99", "A1"]
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertTrue(result["finalizado"])
        self.assertEqual(result["status"], "acerto")
        self.assertEqual(result["jogada_quantica"], [0, 0])
        self.assertEqual(self.states[game_id]["meta"]["vencedor"], "computador")

    def test_empty_cache_is_not_a_computer_victory(self):
        game_id = self.start_game()
        self.states[game_id]["vez_do_jogador"] = False
        self.states[game_id]["pilha"] = []
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertTrue(result["finalizado"])
        self.assertEqual(self.states[game_id]["meta"]["vencedor"], "sem_jogadas")

    def test_validation_and_secret_code(self):
        self.start_game(4, 4)
        self.request("/iniciar_jogo", {"tamanho_tabuleiro": 4, "num_navios": 5}, expected=400)
        self.request("/iniciar_jogo", {"tamanho_tabuleiro": None}, expected=400)
        self.request("/iniciar_jogo", {"backend": "default"}, expected=400)
        game_id = self.start_game()
        self.request("/atacar", {"coordenada": "Z99"}, game_id, expected=400)
        secret = self.states[game_id]["codigo_secreto"]
        self.assertTrue(self.request("/atacar", {"coordenada": secret}, game_id)["finalizado"])

    def test_legacy_cache_and_rejection_sampling(self):
        moves = self.handler._normalize_moves({"data": {"tamanho_tabuleiro_5": ["000000", "100100", "111111", "000000"]}}, 5)
        self.assertEqual(moves, ["A1", "E5"])
        self.assertEqual(self.handler._normalize_moves({"moves": ["A1", "Z9", "A1"]}, 8), ["A1"])
        class NoSuchKey(Exception):
            pass
        client = MagicMock()
        client.exceptions.NoSuchKey = NoSuchKey
        client.get_object.side_effect = [NoSuchKey(), NoSuchKey(), {"Body": io.BytesIO(json.dumps({"data": {"tamanho_tabuleiro_8": ["000000", "111111"]}}).encode())}]
        with patch.object(self.handler, "s3", client):
            self.assertEqual(self.handler._load_moves_from_s3("iqm_garnet", 8), ["A1", "H8"])

    def test_dynamodb_numbers_and_restoration(self):
        game_id = self.start_game()
        state = self.states[game_id]
        state["tabuleiro_jogador"][0][0] = Decimal(1)
        self.assertEqual(json.loads(self.handler._resp(200, state)["body"])["tabuleiro_jogador"][0][0], 1)
        with patch.object(self.handler.Jogo, "posicionar_navios", side_effect=AssertionError("Restoration must not regenerate ships")):
            self.assertEqual(self.handler._state_to_game(state).codigo_secreto, state["codigo_secreto"])

    def test_dense_fleet_terminates(self):
        with patch.object(random, "randint", return_value=0), patch.object(random, "choice", return_value="H"):
            game = self.handler.Jogo(4, 4)
        self.assertEqual(sum(map(sum, game.tabuleiro_jogador)), 10)
        self.assertEqual(sorted(map(len, game.navios_jogador)), [1, 2, 3, 4])

    def test_circuit_and_raw_measurement_analysis(self):
        game_id = self.start_game(8)
        meta = self.states[game_id]["meta"]
        self.assertEqual(meta["circuito"]["qubits_total"], 6)
        self.assertEqual(meta["circuito"]["probabilidade_celula"], "1/64")
        self.assertEqual(len(meta["medicoes_brutas"]), 2048)
        self.assertTrue(all(len(bits) == 6 for bits in meta["medicoes_brutas"]))
        self.assertEqual(sum(self.handler._analise_medicoes(meta["medicoes_brutas"], 8)["frequencias"]), 2048)
        uniformes = [format(valor, "04b") for valor in range(16)] * 8
        analyse = self.handler._analise_medicoes(uniformes, 4)
        self.assertEqual(analyse["qui_quadrado"], 0)
        self.assertEqual(analyse["entropia_bits"], 4)
        self.assertFalse(self.handler._analise_medicoes([], 8)["disponivel"])
        self.request("/iniciar_jogo", {"modo": "simulador", "tamanho_tabuleiro": 10}, expected=400)

    def test_enemy_fleet_reveals_only_sizes_and_sunk_status(self):
        game_id = self.start_game(8, 5)
        state = self.states[game_id]
        self.assertEqual(sorted(navio["tamanho"] for navio in self.handler._frota_adversaria(state)), [1, 2, 3, 4, 5])
        self.assertTrue(all(set(navio) == {"id", "tamanho", "afundado"} for navio in self.handler._frota_adversaria(state)))
        state["tabuleiro_quantico"] = [[0] * 8 for _ in range(8)]
        state["navios_quantico"] = [[[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 4]]]
        for coluna in range(5):
            state["tabuleiro_quantico"][0][coluna] = 1
        for coluna in range(3):
            result = self.request("/atacar", {"coordenada": f"A{coluna + 1}"}, game_id)
            self.assertIsNone(result["navio_afundado"])
            self.assertFalse(result["frota_adversaria"][0]["afundado"])
        result = self.request("/atacar", {"coordenada": "A4"}, game_id)
        self.assertEqual(result["navio_afundado"]["tamanho"], 4)
        self.assertEqual(result["navio_afundado"]["coordenadas"], ["A1", "A2", "A3", "A4"])
        self.assertFalse(result["frota_adversaria"][1]["afundado"])
        self.assertIn("afundado", result["mensagem"])
        restored = self.request("/estado", game_id=game_id, method="GET")
        self.assertTrue(restored["frota_adversaria"][0]["afundado"])
        result = self.request("/atacar", {"coordenada": "A5"}, game_id)
        self.assertTrue(result["finalizado"])
        self.assertEqual(result["navio_afundado"]["tamanho"], 1)
        self.assertTrue(all(navio["afundado"] for navio in result["resumo"]["frota_adversaria"]))
        del self.states[game_id]["navios_quantico"]
        self.assertIsNone(self.handler._frota_adversaria(self.states[game_id]))

    def test_vertical_five_cell_ship_and_miss(self):
        game_id = self.start_game(8, 5)
        state = self.states[game_id]
        state["tabuleiro_quantico"] = [[0] * 8 for _ in range(8)]
        state["navios_quantico"] = [[[linha, 0] for linha in range(5)], [[0, 1]]]
        for linha in range(5):
            state["tabuleiro_quantico"][linha][0] = 1
        state["tabuleiro_quantico"][0][1] = 1
        for linha in range(5):
            result = self.request("/atacar", {"coordenada": f"{chr(65 + linha)}1"}, game_id)
            if linha < 4:
                self.assertIsNone(result["navio_afundado"])
        self.assertEqual(result["navio_afundado"]["tamanho"], 5)
        self.assertEqual(result["navio_afundado"]["coordenadas"], ["A1", "B1", "C1", "D1", "E1"])
        self.request("/atacar", {"coordenada": "E1"}, game_id, expected=409)
        result = self.request("/atacar", {"coordenada": "F2"}, game_id)
        self.assertEqual(result["status"], "erro")
        self.assertIsNone(result["navio_afundado"])
        self.assertTrue(result["frota_adversaria"][0]["afundado"])
        self.assertFalse(result["frota_adversaria"][1]["afundado"])

    def test_plus_keeps_target_across_player_turn_and_resumes_quantum(self):
        game_id = self.request("/iniciar_jogo", {"modo": "simulador", "dificuldade": "plus", "tamanho_tabuleiro": 8})["game_id"]
        state = self.states[game_id]
        state["tabuleiro_jogador"] = [[0] * 8 for _ in range(8)]
        state["navios_jogador"] = [[[2, 2], [2, 3], [2, 4]], [[7, 7]]]
        for row, col in [[2, 2], [2, 3], [2, 4], [7, 7]]:
            state["tabuleiro_jogador"][row][col] = 1
        state["pilha"] = ["C3", "A1"]
        state["vez_do_jogador"] = False
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["fonte_ataque"], "quantico")
        self.assertTrue(result["chip_classico_ativo"])
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["fonte_ataque"], "classico")
        self.assertEqual(result["jogada_quantica"], [1, 2])
        self.assertTrue(result["vez_do_jogador"])
        self.assertTrue(result["chip_classico_ativo"])
        self.assertEqual(self.states[game_id]["pilha"], ["A1"])
        self.states[game_id]["tabuleiro_quantico"][0][0] = 0
        self.request("/atacar", {"coordenada": "A1"}, game_id)
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["jogada_quantica"], [2, 3])
        self.states[game_id]["tabuleiro_quantico"][0][1] = 0
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["jogada_quantica"], [2, 1])
        self.request("/atacar", {"coordenada": "A2"}, game_id)
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["jogada_quantica"], [2, 4])
        self.assertFalse(result["chip_classico_ativo"])
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["fonte_ataque"], "quantico")
        self.assertEqual(result["jogada_quantica"], [0, 0])
        summary = self.handler._resumo_partida(self.states[game_id])
        self.assertEqual(summary["estatisticas"]["computador"]["jogadas"], 6)
        self.assertEqual(summary["dificuldade"], "plus")

    def test_player_fleet_updates_after_computer_attack(self):
        game_id = self.start_game(8)
        state = self.states[game_id]
        state["tabuleiro_jogador"] = [[0] * 8 for _ in range(8)]
        state["navios_jogador"] = [[[0, 0], [0, 1]], [[7, 7]]]
        for row, col in [[0, 0], [0, 1], [7, 7]]:
            state["tabuleiro_jogador"][row][col] = 1
        state["pilha"] = ["A1", "A2"]
        state["vez_do_jogador"] = False
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertFalse(result["frota_jogador"][0]["afundado"])
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertTrue(result["frota_jogador"][0]["afundado"])
        self.assertFalse(result["frota_jogador"][1]["afundado"])
        self.assertEqual(self.request("/estado", game_id=game_id, method="GET")["frota_jogador"], result["frota_jogador"])
        self.assertEqual(self.handler._resumo_partida(self.states[game_id])["frota_jogador"], result["frota_jogador"])

    def test_plus_single_ship_and_vertical_border(self):
        game_id = self.request("/iniciar_jogo", {"modo": "simulador", "dificuldade": "plus"})["game_id"]
        state = self.states[game_id]
        state["tabuleiro_jogador"] = [[0] * 8 for _ in range(8)]
        state["navios_jogador"] = [[[0, 0]], [[0, 7], [1, 7]], [[7, 0]]]
        for row, col in [[0, 0], [0, 7], [1, 7], [7, 0]]:
            state["tabuleiro_jogador"][row][col] = 1
        state["pilha"] = ["A1", "A8", "H1"]
        state["vez_do_jogador"] = False
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertFalse(result["chip_classico_ativo"])
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertTrue(result["chip_classico_ativo"])
        self.assertTrue(self.request("/estado", game_id=game_id, method="GET")["chip_classico_ativo"])
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["jogada_quantica"], [1, 7])
        self.assertFalse(result["chip_classico_ativo"])
        self.assertEqual(self.states[game_id]["pilha"], ["H1"])

    def test_plus_reuses_previously_hit_target_cells(self):
        game_id = self.request("/iniciar_jogo", {"modo": "simulador", "dificuldade": "plus"})["game_id"]
        state = self.states[game_id]
        state["tabuleiro_jogador"] = [[0] * 8 for _ in range(8)]
        state["navios_jogador"] = [[[0, col] for col in range(4)], [[7, 7]]]
        state["tabuleiro_jogador"][0][:4] = [2, 2, 1, 1]
        state["tabuleiro_jogador"][7][7] = 1
        state["pilha"] = ["A3", "H8"]
        state["vez_do_jogador"] = False
        self.request("/ataque-quantico", game_id=game_id, method="GET")
        result = self.request("/ataque-quantico", game_id=game_id, method="GET")
        self.assertEqual(result["fonte_ataque"], "classico")
        self.assertEqual(result["jogada_quantica"], [0, 3])
        self.assertFalse(result["chip_classico_ativo"])
        self.assertEqual(self.states[game_id]["pilha"], ["H8"])

    def test_summary_survives_reload_and_supports_legacy_games(self):
        game_id = self.start_game()
        self.request("/atacar", {"coordenada": self.states[game_id]["codigo_secreto"]}, game_id)
        self.assertEqual(self.request("/estado", game_id=game_id, method="GET")["resumo"]["vencedor"], "jogador")
        del self.states[game_id]["navios_quantico"]
        self.assertIsNone(self.handler._resumo_partida(self.states[game_id])["estatisticas"]["jogador"]["navios_afundados"])

    def test_legacy_cache_summary_analyses_recorded_quantum_attacks(self):
        game_id = self.start_game(4, 2)
        state = self.states[game_id]
        state["meta"]["modo"] = "cache"
        state["meta"]["medicoes_brutas"] = []
        state["meta"]["historico"] = [
            {"tipo": "ataque_quantico", "linha": 0, "coluna": 0, "acertou": False},
            {"tipo": "ataque_classico", "linha": 0, "coluna": 1, "acertou": True},
            {"tipo": "ataque_quantico", "linha": 2, "coluna": 3, "acertou": True},
        ]

        analise = self.handler._resumo_partida(state)["analise"]

        self.assertTrue(analise["disponivel"])
        self.assertEqual(analise["amostras"], 2)
        self.assertEqual(analise["celulas_observadas"], 2)
        self.assertIn("cache", analise["base"])

    def test_state_queue_and_cancel(self):
        self.assertFalse(self.request("/estado", method="GET")["em_andamento"])
        game_id = self.start_game(8)
        self.request("/fila/entrar", {"nome": "Teste"}, game_id)
        self.request("/fila/entrar", {"nome": "Teste"}, game_id)
        result = self.request("/estado", game_id=game_id, method="GET")
        self.assertEqual(result["fila_espera"], ["Teste"])
        self.assertTrue(result["em_andamento"])
        self.assertEqual(result["tamanho_tabuleiro"], 8)
        self.assertNotIn(1, [cell for row in result["ataques_jogador"] for cell in row])
        self.request("/encerrar_jogo", game_id=game_id)
        self.assertFalse(self.request("/estado", game_id=game_id, method="GET")["em_andamento"])

    def test_finished_match_archive_uses_stable_ids_and_mode(self):
        game_id = self.request("/iniciar_jogo", {"nome": "Teste", "modo": "simulador", "backend": "ionq_forte", "tamanho_tabuleiro": 8, "num_navios": 4})["game_id"]
        tabuleiro = copy.deepcopy(self.states[game_id]["tabuleiro_quantico"])
        for linha, row in enumerate(tabuleiro):
            for coluna, cell in enumerate(row):
                if cell == 1:
                    result = self.request("/atacar", {"coordenada": self.handler.coord_para_letra_numero(linha, coluna)}, game_id)
        state = self.states[game_id]
        state["tabuleiro_jogador"][0][0] = Decimal(1)
        class NoSuchKey(Exception):
            pass
        client = MagicMock()
        client.exceptions.NoSuchKey = NoSuchKey
        documents = {}
        def get_object(Bucket, Key):
            if Key not in documents:
                raise NoSuchKey()
            return {"Body": io.BytesIO(json.dumps(documents[Key]).encode())}
        def put_object(Bucket, Key, Body, ContentType):
            documents[Key] = json.loads(Body)
        client.get_object.side_effect = get_object
        client.put_object.side_effect = put_object
        with patch.object(self.handler, "s3", client):
            self.patches[2].stop()
            self.handler._persist_partida_e_jogador_no_s3(state)
            self.handler._persist_partida_e_jogador_no_s3(state)
        match = documents[f"partidas/{game_id}.json"]
        self.assertEqual(match["modo"], "simulador")
        self.assertEqual(match["backend"], "ionq_forte")
        self.assertEqual(match["jogador"]["nome"], "Teste")
        self.assertEqual(match["vencedor"], "jogador")
        self.assertEqual(match["pontuacao"], result["resumo"]["pontuacao"])
        player = documents[f"jogadores/{state['meta']['jogador_id']}.json"]
        self.assertEqual(player["pontuacao_global"]["vitorias"], 1)
        self.assertEqual(player["pontuacao_global"]["partidas"], 1)
        self.assertEqual(player["pontuacao_global"]["pontos_totais"], match["pontuacao"])
        self.assertEqual(len(player["partidas"]), 1)

    def test_manual_end_archives_partial_score_as_abandoned(self):
        game_id = self.start_game()
        self.states[game_id]["meta"]["placar"]["jogador"] = 2
        self.states[game_id]["meta"]["historico"] = [
            {"tipo": "ataque_jogador", "linha": 0, "coluna": indice, "acertou": True}
            for indice in range(2)
        ]

        result = self.request("/encerrar_jogo", game_id=game_id)

        self.assertEqual(result["pontuacao"], 2)
        self.assertEqual(self.states[game_id]["meta"]["vencedor"], "abandonada")
        self.assertFalse(self.states[game_id]["meta"]["em_andamento"])
        self.handler._persist_partida_e_jogador_no_s3.assert_called_once()

    def test_score_rewards_fast_minimum_move_win_and_penalizes_extra_moves(self):
        game_id = self.start_game(8, 4)
        state = self.states[game_id]
        state["meta"]["created_at"] = 1000
        state["meta"]["ended_at"] = self.handler.datetime.fromtimestamp(1300, self.handler.timezone.utc).isoformat()
        state["meta"]["vencedor"] = "jogador"
        state["meta"]["placar"]["jogador"] = 10
        state["meta"]["historico"] = [
            {"tipo": "ataque_jogador", "linha": indice % 8, "coluna": indice % 8, "acertou": indice < 10}
            for indice in range(12)
        ]

        resumo = self.handler._resumo_partida(state)

        self.assertEqual(resumo["jogadas_minimas"], 10)
        self.assertEqual(resumo["bonus_tempo"], 30)
        self.assertEqual(resumo["penalidade_jogadas"], 2)
        self.assertEqual(resumo["pontuacao"], 38)

        state["meta"]["vitoria_por_codigo"] = True
        resumo_codigo = self.handler._resumo_partida(state)
        self.assertEqual(resumo_codigo["bonus_tempo"], 0)
        self.assertEqual(resumo_codigo["penalidade_jogadas"], 0)
        self.assertEqual(resumo_codigo["pontuacao"], 10)

    def test_global_ranking_reads_and_sorts_player_s3_documents(self):
        client = MagicMock()
        client.list_objects_v2.side_effect = [
            {"Contents": [{"Key": "jogadores/ana.json"}], "IsTruncated": True, "NextContinuationToken": "next"},
            {"Contents": [{"Key": "jogadores/bia.json"}, {"Key": "jogadores/caio.json"}], "IsTruncated": False},
        ]
        jogadores = {
            "jogadores/ana.json": {"nome": "Ana", "pontuacao_global": {"pontos_totais": 80}},
            "jogadores/bia.json": {"nome": "Bia", "pontuacao_global": {"pontos_totais": 120}},
            "jogadores/caio.json": {"nome": "Caio", "pontuacao_global": {"pontos_totais": 120}},
        }
        client.get_object.side_effect = lambda Bucket, Key: {"Body": io.BytesIO(json.dumps(jogadores[Key]).encode())}

        with patch.object(self.handler, "s3", client):
            ranking = self.handler._ranking_global()

        self.assertEqual(ranking, [
            {"nome": "Bia", "pontos": 120},
            {"nome": "Caio", "pontos": 120},
            {"nome": "Ana", "pontos": 80},
        ])
        self.assertEqual(client.list_objects_v2.call_count, 2)

    def test_analytics_aggregates_selected_hardware_and_excludes_classical_attacks(self):
        partidas = [
            {
                "partida_id": "match-a",
                "backend": "ionq_forte",
                "tamanho_tabuleiro": 4,
                "ended_at": "2026-01-01T00:00:02Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 0, "coluna": 0, "acertou": False, "t": "2026-01-01T00:00:00Z"},
                    {"tipo": "ataque_classico", "linha": 0, "coluna": 1, "acertou": True, "t": "2026-01-01T00:00:01Z"},
                ],
            },
            {
                "partida_id": "match-b",
                "backend": "ionq_forte",
                "tamanho_tabuleiro": 4,
                "ended_at": "2026-01-02T00:00:01Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 1, "coluna": 1, "acertou": True, "t": "2026-01-02T00:00:00Z"},
                ],
            },
            {
                "partida_id": "match-hardware-simulado",
                "backend": "ionq_forte",
                "modo": "simulador",
                "origem_jogadas": "simulador_cache_v0",
                "tamanho_tabuleiro": 4,
                "ended_at": "2026-01-03T00:00:01Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 2, "coluna": 2, "acertou": True, "t": "2026-01-03T00:00:00Z"},
                ],
            },
            {
                "partida_id": "match-backend-simulador",
                "backend": "simulador",
                "modo": "simulador",
                "tamanho_tabuleiro": 4,
                "ended_at": "2026-01-04T00:00:01Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 1, "coluna": 1, "acertou": True, "t": "2026-01-04T00:00:00Z"},
                ],
            },
            {
                "partida_id": "match-c",
                "backend": "rigetti_cepheus",
                "tamanho_tabuleiro": 8,
                "ended_at": "2026-01-03T00:00:01Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 0, "coluna": 0, "acertou": True, "t": "2026-01-03T00:00:00Z"},
                ],
            },
        ]
        with patch.object(self.handler, "_listar_partidas_s3", return_value=partidas):
            result = self.request("/analises", method="GET", query={"hardware": "ionq_forte", "tamanho_tabuleiro": "4"})

        self.assertEqual(result["amostras"], 3)
        self.assertEqual(result["ataques_classicos_excluidos"], 1)
        self.assertEqual(result["partidas_modo_simulador"], 1)
        self.assertEqual(result["partidas_total"], 3)
        self.assertEqual(result["partidas"][0]["hardware"], "ionq_forte")
        self.assertEqual(result["partidas"][0]["origem_jogadas"], "simulador_cache_v0")
        self.assertEqual(result["partidas_analisadas"], 3)
        self.assertEqual(result["analise"]["frequencias"], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])
        self.assertAlmostEqual(result["analise"]["min_entropia_empirica_bits"], 1.5849625007)
        self.assertFalse(result["xeb"]["disponivel"])
        self.assertFalse(result["tqc"]["disponivel"])
        self.assertEqual([partida["id"] for partida in result["partidas"]], ["match-hardware-simulado", "match-b", "match-a"])

    def test_analytics_requires_valid_board_size(self):
        with patch.object(self.handler, "_listar_partidas_s3", return_value=[]):
            self.request("/analises", method="GET", query={"hardware": "ionq_forte"}, expected=400)
            self.request("/analises", method="GET", query={"hardware": "ionq_forte", "tamanho_tabuleiro": "10"}, expected=400)

    def test_analytics_combines_board_sizes_with_stratified_uniform_baseline(self):
        partidas = [
            {
                "partida_id": "match-4",
                "backend": "ionq_forte",
                "tamanho_tabuleiro": 4,
                "ended_at": "2026-01-01T00:00:00Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 0, "coluna": 0, "acertou": False, "t": "2026-01-01T00:00:00Z"},
                    {"tipo": "ataque_quantico", "linha": 3, "coluna": 3, "acertou": True, "t": "2026-01-01T00:00:01Z"},
                ],
            },
            {
                "partida_id": "match-8",
                "backend": "ionq_forte",
                "tamanho_tabuleiro": 8,
                "ended_at": "2026-01-02T00:00:00Z",
                "historico": [
                    {"tipo": "ataque_quantico", "linha": 7, "coluna": 7, "acertou": True, "t": "2026-01-02T00:00:00Z"},
                ],
            },
        ]
        with patch.object(self.handler, "_listar_partidas_s3", return_value=partidas):
            result = self.request("/analises", method="GET", query={"hardware": "ionq_forte", "tamanho_tabuleiro": "todos"})

        analise = result["analise"]
        self.assertEqual(result["tamanho_tabuleiro"], "todos")
        self.assertEqual(result["amostras"], 3)
        self.assertEqual(sum(analise["frequencia_linha_normalizada"]), 3)
        self.assertEqual(sum(analise["esperada_linha_normalizada"]), 3)
        self.assertEqual([item["tamanho_tabuleiro"] for item in analise["entropia_por_tabuleiro"]], [4, 8])
        self.assertEqual([partida["tamanho_tabuleiro"] for partida in result["partidas"]], [8, 4])
        self.assertFalse(result["entropia_certificada"]["disponivel"])

    def test_match_archive_listing_paginates_s3(self):
        documentos = {
            "partidas/a.json": {"partida_id": "a", "backend": "ionq_forte"},
            "partidas/b.json": {"partida_id": "b", "backend": "rigetti_cepheus"},
        }
        client = MagicMock()
        client.list_objects_v2.side_effect = [
            {"Contents": [{"Key": "partidas/a.json"}], "IsTruncated": True, "NextContinuationToken": "next"},
            {"Contents": [{"Key": "partidas/b.json"}], "IsTruncated": False},
        ]
        client.get_object.side_effect = lambda Bucket, Key: {"Body": io.BytesIO(json.dumps(documentos[Key]).encode())}

        with patch.object(self.handler, "s3", client):
            partidas = self.handler._listar_partidas_s3()

        self.assertEqual([partida["partida_id"] for partida in partidas], ["a", "b"])
        self.assertEqual(client.list_objects_v2.call_count, 2)
        self.assertEqual(client.list_objects_v2.call_args_list[1].kwargs["ContinuationToken"], "next")


if __name__ == "__main__":
    unittest.main()