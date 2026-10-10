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

    def request(self, path, body=None, game_id=None, method="POST", expected=200):
        response = self.handler.handler({
            "rawPath": path,
            "requestContext": {"http": {"method": method}},
            "body": json.dumps(body or {}),
            "headers": {"x-game-id": game_id} if game_id else {},
        }, None)
        data = json.loads(response["body"])
        self.assertEqual(response["statusCode"], expected, data)
        return data

    def start_game(self, size=10, ships=4):
        return self.request("/iniciar_jogo", {"nome": "Teste", "modo": "simulador", "tamanho_tabuleiro": size, "num_navios": ships})["game_id"]

    def test_player_can_finish_every_board_size(self):
        for size in range(4, 21):
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

    def test_computer_turn_and_final_hit(self):
        game_id = self.start_game()
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

    def test_summary_survives_reload_and_supports_legacy_games(self):
        game_id = self.start_game()
        self.request("/atacar", {"coordenada": self.states[game_id]["codigo_secreto"]}, game_id)
        self.assertEqual(self.request("/estado", game_id=game_id, method="GET")["resumo"]["vencedor"], "jogador")
        del self.states[game_id]["navios_quantico"]
        self.assertIsNone(self.handler._resumo_partida(self.states[game_id])["estatisticas"]["jogador"]["navios_afundados"])

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
        game_id = self.start_game()
        self.request("/atacar", {"coordenada": self.states[game_id]["codigo_secreto"]}, game_id)
        state = self.states[game_id]
        state["tabuleiro_jogador"][0][0] = Decimal(1)
        class NoSuchKey(Exception):
            pass
        client = MagicMock()
        client.exceptions.NoSuchKey = NoSuchKey
        client.get_object.side_effect = NoSuchKey()
        with patch.object(self.handler, "s3", client):
            self.patches[2].stop()
            self.handler._persist_partida_e_jogador_no_s3(state)
        documents = {call.kwargs["Key"]: json.loads(call.kwargs["Body"]) for call in client.put_object.call_args_list}
        match = documents[f"partidas/{game_id}.json"]
        self.assertEqual(match["modo"], "simulador")
        self.assertEqual(match["jogador"]["nome"], "Teste")
        self.assertEqual(match["vencedor"], "jogador")
        player = documents[f"jogadores/{state['meta']['jogador_id']}.json"]
        self.assertEqual(player["pontuacao_global"]["vitorias"], 1)


if __name__ == "__main__":
    unittest.main()