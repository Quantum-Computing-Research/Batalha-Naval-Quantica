import unittest
import json
import os
import shutil
from unittest.mock import patch
from app import GerenciadorDeCache

# Caminho para o diretório de teste
TEST_DIR = 'temp_data'

class TestGerenciadorDeCache(unittest.TestCase):
    def setUp(self):
        """Prepara o ambiente antes de cada teste."""
        # 1. Cria a estrutura de diretórios de teste
        os.makedirs(os.path.join(TEST_DIR, 'cache', 'rigetti_ankaa'), exist_ok=True)
        os.makedirs(os.path.join(TEST_DIR, 'jogadores'), exist_ok=True)
        os.makedirs(os.path.join(TEST_DIR, 'relatorios'), exist_ok=True)
        
        # 2. Cria um arquivo de cache com dados iniciais
        self.caminho_cache = os.path.join(TEST_DIR, 'cache', 'rigetti_ankaa', '10x10.json')
        self.jogadas_iniciais = [
            {"id_partida": "partida_1", "dados_randomicos_gerados": [{"bit_string": "101", "coordenada": {"x": 1, "y": 1}}]},
            {"id_partida": "partida_2", "dados_randomicos_gerados": [{"bit_string": "102", "coordenada": {"x": 2, "y": 2}}]},
            {"id_partida": "partida_3", "dados_randomicos_gerados": [{"bit_string": "103", "coordenada": {"x": 3, "y": 3}}]}
        ]
        with open(self.caminho_cache, 'w') as f:
            json.dump(self.jogadas_iniciais, f, indent=2)

        # 3. Cria um arquivo de tarefas pendentes vazio
        self.caminho_tasks = os.path.join(TEST_DIR, 'pending_tasks.json')
        with open(self.caminho_tasks, 'w') as f:
            json.dump([], f)

        # 4. Instancia a classe que vamos testar
        self.gerenciador = GerenciadorDeCache(caminho_base=TEST_DIR)

    def tearDown(self):
        """Limpa o ambiente após cada teste."""
        shutil.rmtree(TEST_DIR)

    @patch('meu_modulo_do_jogo.GerenciadorDeCache._disparar_job_assincrono')
    def test_pegar_jogada_do_cache_nao_vazio(self, mock_disparar_job):
        """Testa se uma jogada é pega e a reposição é disparada."""
        hardware = 'rigetti_ankaa'
        tabuleiro = '10x10'
        
        # 1. Executa a função que queremos testar
        jogada_obtida = self.gerenciador.pegar_jogada_e_disparar_replenish(hardware, tabuleiro)

        # 2. Verifica se a jogada correta foi retornada
        self.assertEqual(jogada_obtida['id_partida'], 'partida_3')

        # 3. Verifica se a jogada foi removida do cache
        with open(self.caminho_cache, 'r') as f:
            jogadas_restantes = json.load(f)
            self.assertEqual(len(jogadas_restantes), 2)
            self.assertNotIn(jogada_obtida, jogadas_restantes)

        # 4. Verifica se a função de repor foi chamada
        mock_disparar_job.assert_called_once_with(hardware, tabuleiro)

    @patch('meu_modulo_do_jogo.GerenciadorDeCache._disparar_job_assincrono')
    def test_pegar_jogada_do_cache_vazio(self, mock_disparar_job):
        """Testa o comportamento quando o cache está vazio."""
        hardware = 'rigetti_ankaa'
        tabuleiro = '10x10'
        
        # Esvazia o cache antes do teste
        with open(self.caminho_cache, 'w') as f:
            json.dump([], f)

        # 1. Executa a função que queremos testar
        jogada_obtida = self.gerenciador.pegar_jogada_e_disparar_replenish(hardware, tabuleiro)

        # 2. Verifica se a função retornou None
        self.assertIsNone(jogada_obtida)

        # 3. Verifica se a função de repor foi chamada mesmo com o cache vazio
        mock_disparar_job.assert_called_once_with(hardware, tabuleiro)

    @patch('meu_modulo_do_jogo.GerenciadorDeCache._disparar_job_assincrono')
    def test_pegar_jogada_arquivo_nao_existe(self, mock_disparar_job):
        """Testa o comportamento quando o arquivo de cache não existe."""
        hardware = 'rigetti_ankaa'
        tabuleiro = '10x10'
        
        # Remove o arquivo de cache antes do teste
        os.remove(self.caminho_cache)

        # 1. Executa a função que queremos testar
        jogada_obtida = self.gerenciador.pegar_jogada_e_disparar_replenish(hardware, tabuleiro)

        # 2. Verifica se a função retornou None
        self.assertIsNone(jogada_obtida)

        # 3. Verifica se a função de repor foi chamada
        mock_disparar_job.assert_called_once_with(hardware, tabuleiro)

# Para rodar os testes a partir da linha de comando
if __name__ == '__main__':
    unittest.main()