import json
import os
import random
import threading
from datetime import datetime
import logging

# Instância do logger, configurada como no seu código
logger = logging.getLogger(__name__)

class TaskQueueManager:
    def __init__(self, caminho_base="data/q_tasks"):
        self.caminho_base = caminho_base
        self.caminho_tasks = os.path.join(self.caminho_base, "q_tasks/tasks_pendentes.json")
        self.lock = threading.Lock() # Lock para o arquivo de tarefas

    def add_task(self, nova_tarefa):
        """Adiciona uma nova tarefa à fila de pendentes de forma segura."""
        with self.lock:
            try:
                with open(self.caminho_tasks, 'r+') as f:
                    tarefas = json.load(f)
                    tarefas.append(nova_tarefa)
                    f.seek(0)
                    json.dump(tarefas, f, indent=2)
                    f.truncate()
                logger.info(f"Tarefa quântica {nova_tarefa} adicionada à fila de pendentes.")
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao adicionar tarefa à fila: {e}")

    def get_pending_tasks(self):
        """Lê o arquivo e retorna a lista de tarefas pendentes."""
        with self.lock:
            try:
                with open(self.caminho_tasks, 'r') as f:
                    tarefas = json.load(f)
                return [t for t in tarefas if t['status'] in ['QUEUED', 'RUNNING']]
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao obter tarefas pendentes: {e}")
                return []
    
    def update_task_status(self, task_id, new_status):
        """Atualiza o status de uma tarefa específica no arquivo."""
        with self.lock:
            try:
                with open(self.caminho_tasks, 'r+') as f:
                    tarefas = json.load(f)
                    
                    found = False
                    for tarefa in tarefas:
                        if tarefa['task_id'] == task_id:
                            tarefa['status'] = new_status
                            found = True
                            break
                    
                    if found:
                        f.seek(0)
                        json.dump(tarefas, f, indent=2)
                        f.truncate()
                        logger.info(f"Status da tarefa {task_id} atualizado para {new_status}.")
                    else:
                        logger.warning(f"Tarefa {task_id} não encontrada para atualização.")
            except (FileNotFoundError, ValueError) as e:
                logger.error(f"Erro ao atualizar status da tarefa {task_id}: {e}")


