import logging
import math
from datetime import datetime

from braket.aws import AwsDevice, AwsSession, AwsQuantumTask
from braket.circuits import Circuit
from boto3 import Session

logger = logging.getLogger(__name__)

class AwsQuantumApi:
    def __init__(self):
        # Initialize AWS session once
        self.boto_session = Session(profile_name='default')
        self.aws_session = AwsSession(boto_session=self.boto_session)

    def create_quantum_task(self, hardware, tamanho_tabuleiro):
        """
        Creates a quantum circuit and dispatches an asynchronous job to AWS.
        Returns the AWS task object.
        """
        try:
            # Logic to size the circuit based on board size
            num_qubits_per_eixo = math.ceil(math.log2(tamanho_tabuleiro))
            num_qubits_total = 2 * num_qubits_per_eixo
            
            # Logic to determine the number of shots (20% extra)
            num_jogadas_necessarias = tamanho_tabuleiro * tamanho_tabuleiro
            shots = math.ceil(num_jogadas_necessarias * 1.2)
            
            device_arn = f"arn:aws:braket:::device/quantum-simulator/{hardware}"
            device = AwsDevice(device_arn, aws_session=self.aws_session)
            
            circuit = Circuit()
            for i in range(num_qubits_total):
                circuit.h(i)
            for i in range(num_qubits_total):
                circuit.measure(i)

            task = device.run(circuit, shots=shots)
            return task

        except Exception as e:
            logger.error(f"Failed to create quantum task on AWS: {e}")
            return None
    
    def get_task_result(self, task_arn):
        """
        Connects to AWS to get the result of a completed task.
        """
        try:
            task_obj = AwsQuantumTask(arn=task_arn, aws_session=self.aws_session)
            result = task_obj.result()
            return result
        except Exception as e:
            logger.error(f"Failed to get result for task {task_arn}: {e}")
            return None
        
    def verifica_status_tarefa(self, task_arn):
        """
        Função simulada para verificar o status de uma tarefa na AWS.
        Na implementação real, você usaria a API da AWS para obter o status.
        """
        tarefa = AwsQuantumTask(arn=task_arn)
        return tarefa.state()