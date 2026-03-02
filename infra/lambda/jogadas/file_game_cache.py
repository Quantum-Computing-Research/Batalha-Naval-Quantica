import json
import os
import random
import logging
from datetime import datetime
from aws_quantum_api import AwsQuantumApi

class CacheManager:
    def __init__(self, caminho_base="data"):
        self.caminho_base = caminho_base
        self.caminho_tasks = os.path.join(caminho_base, "pending_tasks.json")

    def _pegar_caminho_cache(self, hardware, tamanho_tabuleiro):
        return os.path.join(self.caminho_base, "cache", hardware, f"{tamanho_tabuleiro}.json")

    def _disparar_job_assincrono(self, hardware, tamanho_tabuleiro, shots=1):
        try:
            # Substituir esta linha pela sua lógica do Braket
            # task = device.run(circuit, shots=shots)
            task_arn = f"arn:aws:braket:.../{random.randint(1000, 9999)}"
            
            caminho_cache = self._pegar_caminho_cache(hardware, tamanho_tabuleiro)
            
            nova_tarefa = {
                "task_id": task_arn,
                "status": "QUEUED",
                "hardware": hardware,
                "tamanho_tabuleiro": tamanho_tabuleiro,
                "caminho_cache": caminho_cache,
                "data_disparo": datetime.now().isoformat()
            }
            
            with open(self.caminho_tasks, 'r+') as f:
                tarefas_pendentes = json.load(f)
                tarefas_pendentes.append(nova_tarefa)
                f.seek(0)
                json.dump(tarefas_pendentes, f, indent=2)
                f.truncate()
            
            logger.info(f"Tarefa quântica {task_arn} disparada e adicionada à fila de pendentes.")
            
        except Exception as e:
            logger.error(f"Erro ao disparar job quântico: {e}")

    def pegar_jogada_e_disparar_replenish(self, hardware, tamanho_tabuleiro):
        caminho_arquivo = self._pegar_caminho_cache(hardware, tamanho_tabuleiro)
        
        try:
            with open(caminho_arquivo, 'r+') as f:
                jogadas = json.load(f)
                if not jogadas:
                    logger.warning("Cache está vazio. Retornando jogada de backup.")
                    self._disparar_job_assincrono(hardware, tamanho_tabuleiro) # Tentar reabastecer
                    return None 
                
                jogada_consumida = jogadas.pop()
                f.seek(0)
                json.dump(jogadas, f, indent=2)
                f.truncate()
            
            self._disparar_job_assincrono(hardware, tamanho_tabuleiro)
            logger.info(f"Jogada consumida do cache {caminho_arquivo}. Reposição disparada.")

            return jogada_consumida

        except (FileNotFoundError, ValueError) as e:
            logger.error(f"Erro ao acessar o cache em {caminho_arquivo}: {e}. Retornando jogada de backup.")
            self._disparar_job_assincrono(hardware, tamanho_tabuleiro) # Tentar reabastecer
            return None # Retornar None ou uma jogada de backup

def verificar_e_processar_tarefas(caminho_base="data"):
    caminho_tasks = os.path.join(caminho_base, "pending_tasks.json")

    try:
        with open(caminho_tasks, 'r+') as f:
            tarefas_pendentes = json.load(f)
        
        tarefas_para_remover = []
        
        for i, tarefa in enumerate(tarefas_pendentes):
            if tarefa["status"] in ["QUEUED", "RUNNING"]:
                logger.info(f"Verificando status da tarefa {tarefa['task_id']}...")
                
                # Simulação do status
                status = "COMPLETED" if random.random() > 0.5 else "QUEUED"

                if status == "COMPLETED":
                    logger.info(f"Tarefa {tarefa['task_id']} CONCLUÍDA! Processando...")
                    nova_jogada = _executar_quantum_job(tarefa['hardware'], tarefa['tamanho_tabuleiro'])
                    
                    caminho_cache = tarefa["caminho_cache"]
                    with open(caminho_cache, 'r+') as f_cache:
                        jogadas_cache = json.load(f_cache)
                        jogadas_cache.append(nova_jogada)
                        f_cache.seek(0)
                        json.dump(jogadas_cache, f_cache, indent=2)
                        f_cache.truncate()
                    logger.info(f"Cache em {caminho_cache} reabastecido.")
                    
                    tarefas_para_remover.append(i)
                
                elif status == "FAILED":
                    logger.error(f"Tarefa {tarefa['task_id']} FALHOU. Removendo da fila.")
                    tarefas_para_remover.append(i)
        
        tarefas_pendentes = [t for i, t in enumerate(tarefas_pendentes) if i not in tarefas_para_remover]
        
        with open(caminho_tasks, 'w') as f:
            json.dump(tarefas_pendentes, f, indent=2)

    except FileNotFoundError:
        logger.warning("Arquivo de tarefas pendentes não encontrado. Criando um novo.")
        with open(caminho_tasks, 'w') as f:
            json.dump([], f)
    except Exception as e:
        logger.error(f"Erro no serviço verificador: {e}", exc_info=True)
