import json
import os
import random
import logging
import threading
import time
from datetime import datetime

# --- Configuração do Logger (continua a mesma) ---
def setup_logging(caminho_base="data"):
    log_dir = os.path.join(caminho_base, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "app.log")
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )

logger = logging.getLogger(__name__)

# --- Lógica de Execução do Job Quântico (Placeholder) ---
def _executar_quantum_job(hardware, tamanho_tabuleiro, shots=1):
    logger.info(f"Simulando job quântico para {hardware} - tabuleiro {tamanho_tabuleiro}...")
    num_bits = 10 
    bit_string = ''.join(random.choice('01') for _ in range(num_bits))
    x = random.randint(1, 10)
    y = random.randint(1, 10)
    
    nova_jogada = {
        "id_partida": f"partida_{datetime.now().strftime('%Y%m%d%H%M%S')}_{random.randint(100, 999)}",
        "data": datetime.now().isoformat(),
        "hardware": hardware,
        "tamanho_tabuleiro": tamanho_tabuleiro,
        "dados_randomicos_gerados": [{
            "bit_string": bit_string,
            "coordenada": {"x": x, "y": y}
        }]
    }
    logger.info(f"Job concluído. Nova jogada gerada: {nova_jogada['dados_randomicos_gerados'][0]}")
    return nova_jogada

# --- Nova Classe para Gerenciar o Cache de Jogadas ---
class CacheManager:
    def __init__(self, caminho_base="data"):
        self.caminho_base = caminho_base
        self.lock = threading.Lock()

    def _get_cache_path(self, hardware, tamanho_tabuleiro):
        return os.path.join(self.caminho_base, "cache", hardware, f"{tamanho_tabuleiro}.json")

    def get_jogada(self, hardware, tamanho_tabuleiro):
        caminho_arquivo = self._get_cache_path(hardware, tamanho_tabuleiro)
        with self.lock:
            try:
                with open(caminho_arquivo, 'r+') as f:
                    jogadas = json.load(f)
                    if not jogadas:
                        logger.warning(f"Cache em {caminho_arquivo} está vazio.")
                        return None
                    jogada = jogadas.pop()
                    f.seek(0)
                    json.dump(jogadas, f, indent=2)
                    f.truncate()
                logger.info(f"Jogada consumida do cache {caminho_arquivo}.")
                return jogada
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao acessar cache {caminho_arquivo}: {e}")
                return None
    
    def add_jogada(self, hardware, tamanho_tabuleiro, nova_jogada):
        caminho_arquivo = self._get_cache_path(hardware, tamanho_tabuleiro)
        with self.lock:
            try:
                with open(caminho_arquivo, 'r+') as f:
                    jogadas = json.load(f)
                    jogadas.append(nova_jogada)
                    f.seek(0)
                    json.dump(jogadas, f, indent=2)
                    f.truncate()
                logger.info(f"Cache em {caminho_arquivo} reabastecido.")
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao reabastecer cache {caminho_arquivo}: {e}")

# --- Nova Classe para Gerenciar a Fila de Tarefas Pendentes ---
class TaskQueueManager:
    def __init__(self, caminho_base="data"):
        self.caminho_base = caminho_base
        self.caminho_tasks = os.path.join(self.caminho_base, "pending_tasks.json")
        self.lock = threading.Lock()
    
    def add_task(self, hardware, tamanho_tabuleiro):
        with self.lock:
            try:
                task_arn = f"arn:aws:braket:.../{random.randint(1000, 9999)}"
                nova_tarefa = {
                    "task_id": task_arn,
                    "status": "QUEUED",
                    "hardware": hardware,
                    "tamanho_tabuleiro": tamanho_tabuleiro,
                    "data_disparo": datetime.now().isoformat()
                }
                
                with open(self.caminho_tasks, 'r+') as f:
                    tarefas = json.load(f)
                    tarefas.append(nova_tarefa)
                    f.seek(0)
                    json.dump(tarefas, f, indent=2)
                    f.truncate()
                logger.info(f"Tarefa quântica {task_arn} adicionada à fila de pendentes.")
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao adicionar tarefa à fila: {e}")

    def get_and_update_tasks(self):
        with self.lock:
            try:
                with open(self.caminho_tasks, 'r') as f:
                    tarefas = json.load(f)
                
                # Simulação da verificação do status
                for tarefa in tarefas:
                    if tarefa["status"] == "QUEUED":
                        if random.random() > 0.5: # 50% de chance de concluir
                            tarefa["status"] = "COMPLETED"
                            logger.info(f"Tarefa {tarefa['task_id']} concluída.")

                with open(self.caminho_tasks, 'w') as f:
                    json.dump(tarefas, f, indent=2)

                return [t for t in tarefas if t['status'] == 'COMPLETED']
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao obter e atualizar tarefas: {e}")
                return []

# --- Classe Principal que Orquestra as Outras ---
class MainGameManager:
    def __init__(self, caminho_base="data"):
        self.cache_manager = CacheManager(caminho_base)
        self.task_manager = TaskQueueManager(caminho_base)

    def get_and_replenish_jogada(self, hardware, tamanho_tabuleiro):
        jogada = self.cache_manager.get_jogada(hardware, tamanho_tabuleiro)
        if jogada:
            self.task_manager.add_task(hardware, tamanho_tabuleiro)
        return jogada
    
    def processar_tasks_concluidas(self):
        tasks_concluidas = self.task_manager.get_and_update_tasks()
        for task in tasks_concluidas:
            nova_jogada = _executar_quantum_job(task['hardware'], task['tamanho_tabuleiro'])
            self.cache_manager.add_jogada(task['hardware'], task['tamanho_tabuleiro'], nova_jogada)

# --- Função de Execução em Thread (Adaptação) ---
def start_background_service(manager):
    while True:
        manager.processar_tasks_concluidas()
        time.sleep(30) # Espera 30 segundos

if __name__ == "__main__":
    setup_logging()
    manager = MainGameManager()

    thread_service = threading.Thread(target=start_background_service, args=(manager,), daemon=True)
    thread_service.start()

    logger.info("O serviço de gerenciamento de cache e tarefas foi iniciado em background.")
    logger.info("--- O jogo principal começa ---")

    # Exemplo de como a lógica do jogo usaria a nova classe
    for i in range(3):
        logger.info(f"\nRodada {i+1}: Obtendo jogada para o jogo...")
        jogada = manager.get_and_replenish_jogada("rigetti_ankaa", "10x10")
        if jogada:
            logger.info(f"Jogada obtida: {jogada['dados_randomicos_gerados'][0]}")
        time.sleep(2)

    logger.info("\n--- Fim da simulação do jogo ---")
    time.sleep(35) # Espera o serviço de background processar