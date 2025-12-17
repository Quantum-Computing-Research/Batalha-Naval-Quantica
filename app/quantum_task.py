import json
import os
import logging
from datetime import datetime
from aws_quantum_api import AwsQuantumApi
import random

from file_game_cache import CacheManager
from file_quantum_task import TaskQueueManager
import threading
import time

logger = logging.getLogger(__name__)

class QuantumTask:
    def __init__(self, caminho_base="data"):
        self.cache_manager = CacheManager(caminho_base)
        self.task_manager = TaskQueueManager(caminho_base)
        self.aws_api = AwsQuantumApi()  

    def get_and_replenish_jogada(self, hardware, tamanho_tabuleiro):
        """
        Recebe o device e o tamanho do tabuleiro, e retorna uma jogada pronta.
        Dispara uma nova tarefa quântica para repor a jogada consumida.
        """
        # 1. Tenta obter uma jogada do cache
        jogada = self.cache_manager.get_jogada(hardware, tamanho_tabuleiro)

        # 2. Inicia a thread para a lógica de reposição.
        # Isso acontecerá imediatamente, sem bloquear a função principal.
        thread_disparo = threading.Thread(
            target=self._criar_e_disparar_job_aws,
            args=(hardware, tamanho_tabuleiro),
            daemon=True
        )
        thread_disparo.start()
    
        # 3. Retorna a jogada (ou None se o cache estava vazio)
        return jogada

    def _criar_e_disparar_job_aws(self, hardware, tamanho_tabuleiro):
        """
        Function executed in a separate thread to trigger the quantum job.
        """
        try:
            task = self.aws_api.create_quantum_task(hardware, tamanho_tabuleiro)
            
            if task:
                nova_tarefa = {
                    "task_id": task.arn,
                    "status": "QUEUED",
                    "hardware": hardware,
                    "tamanho_tabuleiro": tamanho_tabuleiro,
                    "data_disparo": datetime.now().isoformat()
                }
                
                self.task_manager.add_task(nova_tarefa)
                logger.info(f"Quantum task {task.arn} dispatched in thread and added to the pending queue.")
            else:
                logger.error("Failed to create quantum task, not adding to queue.")

        except Exception as e:
            logger.error(f"Error in the quantum job dispatch thread: {e}")

    def processar_tasks_concluidas(self):
        """
        Verifica a fila de tarefas, busca os resultados na AWS e
        adiciona as jogadas ao cache.
        """
    
        # 1. Pega a lista de tarefas pendentes do gerenciador de arquivos
        tarefas_pendentes = self.task_manager.get_pending_tasks()
        
        for tarefa in tarefas_pendentes:
            try:
                # 2. Verifica o status real da tarefa na AWS
                aws_status = self.aws_api.verifica_status_tarefa(task_arn=tarefa['task_id'])
                
                if aws_status == 'COMPLETED':
                    logger.info(f"Tarefa {tarefa['task_id']} CONCLUÍDA! Processando...")
                    
                    # 3. Obtém o resultado completo da AWS
                    result = self.aws_api.get_task_result(tarefa['task_id'])
                    if result:
                        # 4. Processa o resultado e cria a nova jogada
                        nova_jogada = self.processar_resultado_aws(result, tarefa)
                        
                        # 5. Adiciona a jogada processada ao cache
                        self.cache_manager.add_jogada(tarefa['hardware'], tarefa['tamanho_tabuleiro'], nova_jogada)
                    
                    # 6. Atualiza o status da tarefa no gerenciador de arquivos
                    self.task_manager.update_task_status(tarefa['task_id'], 'COMPLETED')
                    
                elif aws_status == 'FAILED':
                    logger.error(f"Tarefa {tarefa['task_id']} FALHOU. Removendo da fila.")
                    self.task_manager.update_task_status(tarefa['task_id'], 'FAILED')
                elif aws_status == 'CANCELLED':
                    logger.error(f"Tarefa {tarefa['task_id']} está CANCELADA. Removendo da fila.")
                    self.task_manager.update_task_status(tarefa['task_id'], 'CANCELLED')
                    
            except Exception as e:
                logger.error(f"Erro ao processar tarefa {tarefa['task_id']}: {e}", exc_info=True)


    def processar_resultado_aws(self, result, task):
        counts = result.measurement_counts
        
        num_qubits_por_eixo = math.ceil(math.log2(task['tamanho_tabuleiro']))
        num_bits_x = num_qubits_por_eixo
        num_bits_y = num_qubits_por_eixo
        
        def binary_to_cartesian(binary_str):
            x = int(binary_str[:num_bits_x], 2)
            y = int(binary_str[num_bits_x:num_bits_x + num_bits_y], 2)
            return x, y
        
        dados_gerados = [{
            "bit_string": binary,
            "coordenada": {"x": binary_to_cartesian(binary)[0], "y": binary_to_cartesian(binary)[1]}
        } for binary in counts.keys()]
        
        nova_jogada = {
            "id_partida": task['task_id'],
            "data": datetime.now().isoformat(),
            "hardware": task['hardware'],
            "tamanho_tabuleiro": task['tamanho_tabuleiro'],
            "dados_randomicos_gerados": dados_gerados
        }
        
        self.cache_manager.add_jogada(task['hardware'], task['tamanho_tabuleiro'], nova_jogada)
        logger.info(f"Job result {task['task_id']} processed and added to cache.")


    @staticmethod
    def iniciar_em_background(caminho_base="data"):
        """
        Método estático para ser chamado no main, que inicia o serviço de
        verificação do cache em uma thread separada.
        """
        manager = QuantumTask(caminho_base)
        
        # A função que será o alvo da thread
        def background_worker(self_manager, intervalo_segundos=180):
            while True:
                try:
                    self_manager.processar_tasks_concluidas()
                except Exception as e:
                    logger.error(f"Erro na thread de background: {e}", exc_info=True)
                time.sleep(intervalo_segundos)

        # Inicia a thread de background
        thread_service = threading.Thread(
            target=background_worker,
            args=(manager,),
            daemon=True
        )
        thread_service.start()
        
        # Retorna a instância do manager para ser usada na aplicação principal
        return manager