import random
from quantum_task import QuantumTask

class Jogo:
    def __init__(self, tamanho_tabuleiro=10, num_navios=4):
        self.quantum_task = QuantumTask()
        self.tamanho_maximo = 20  # Tamanho máximo permitido para o tabuleiro
        if tamanho_tabuleiro > self.tamanho_maximo:
            print(f"⚠️ Alerta: O tamanho máximo do tabuleiro é {self.tamanho_maximo}x{self.tamanho_maximo}.")
            tamanho_tabuleiro = self.tamanho_maximo  # Ajusta o tabuleiro para o tamanho máximo permitido

        self.tamanho_tabuleiro = tamanho_tabuleiro
        self.num_navios = num_navios
        self.tabuleiro_jogador = [[0] * tamanho_tabuleiro for _ in range(tamanho_tabuleiro)]
        self.tabuleiro_quantico = [[0] * tamanho_tabuleiro for _ in range(tamanho_tabuleiro)]
        self.navios_jogador = []
        self.navios_quantico = []
        self.vez_do_jogador = True
        self.pilha_ataques_quanticos = []

        self.codigos_vencedores = [
            "dirac", "hilbert", "boltzmann", "feynman", "noether",
            "pauli", "lorentz", "turing", "laplace", "gauss"
        ]

        self.codigo_secreto = random.choice(self.codigos_vencedores)
        print("******************************************************************")
        print("******************************************************************")
        print("********************* INICIO DA PARTIDA **************************")
        print("******************************************************************")
        print("******************************************************************")
        print(self.codigo_secreto)

        self.posicionar_navios(self.tabuleiro_jogador)  # Posicionando navios do jogador
        self.posicionar_navios(self.tabuleiro_quantico)  # Posicionando navios do computador
        self.gerar_ataques_quanticos(self.tamanho_tabuleiro)


    def ataque_jogador(self, coordenada):

        if self.verificar_codigo_secreto(coordenada):
            self.forcar_vitoria_jogador()
            return True, "Jogo finalizado! O jogador venceu.", False, None, None

        if not self.validar_coordenada(coordenada):
            return False, "Coordenada inválida", False, None, None

        linha, coluna = self.recupera_coordenada(coordenada)


        if not self.validar_coordenada_repetida(linha, coluna, self.tabuleiro_quantico):
            return False, "Coordenada Repetida", False, None, None

        acerto = self.performar_ataque(linha, coluna, self.tabuleiro_quantico)

        # Verifica se o jogo acabou
        if self.verificar_condicao_finalizacao(self.tabuleiro_quantico):
            return True, "Jogo finalizado! O jogador venceu.", False, None, None

        # Passa a vez de jogar se errou
        if not acerto:
            self.vez_do_jogador = False

        mensagem = 'Acertou!' if acerto else 'Errou!'

        return False, mensagem, acerto, linha, coluna

    def ataque_quantico(self):

        if not self.pilha_ataques_quanticos:
            return True, "Jogo Finalizado porque não tem mais jogadas quânticas.", False, None, None


        coordenada = self.pilha_ataques_quanticos.pop(0)

        linha, coluna = self.recupera_coordenada(coordenada)  


        print(linha)
        print(coluna)

        if not self.validar_coordenada_repetida(linha, coluna, self.tabuleiro_jogador):
            return False, "Coordenada Repetida", False, linha, coluna

        acerto = self.performar_ataque(linha, coluna, self.tabuleiro_jogador)

        # Verifica se o jogo acabou
        if self.verificar_condicao_finalizacao(self.tabuleiro_jogador):
            return True, "Jogo finalizado! O computador quântico venceu.", False, None, None

        # Passa a vez de jogar se errou
        if not acerto:
            self.vez_do_jogador = True

        mensagem = 'Acertou!' if acerto else 'Errou!'
      

        return False, mensagem, acerto, linha, coluna

    def validar_coordenada(self, coordenada):
        """Valida as coordenadas fornecidas pelo jogador ou pelo computador."""
        if len(coordenada) < 2:
            return False

        letra = coordenada[0].upper()  # Ex: "C"
        numero = coordenada[1:]  # Ex: "1"

        # Calcula a faixa válida de letras com base no tamanho do tabuleiro
        letras_validas = ''.join(chr(i) for i in range(ord('A'), ord('A') + self.tamanho_tabuleiro))

        # Verifica se a letra está dentro do intervalo permitido
        if letra not in letras_validas:
            return False

        try:
            coluna = int(numero) - 1  # Converte a coluna de 1-10 para 0-9
        except ValueError:
            return False

        # Verifica se a coluna está dentro dos limites do tabuleiro
        if not (0 <= coluna < self.tamanho_tabuleiro):
            return False

        # Verifica se a linha está dentro dos limites do tabuleiro
        linha = ord(letra) - ord('A')
        if not (0 <= linha < self.tamanho_tabuleiro):
            return False

        return True


    def posicionar_navios(self, tabuleiro):
        tamanhos = list(range(1, self.num_navios + 1))  # Tamanhos de 1 até N
        for tamanho in tamanhos:
            colocado = False
            while not colocado:
                linha = random.randint(0, self.tamanho_tabuleiro - 1)
                coluna = random.randint(0, self.tamanho_tabuleiro - 1)
                direcao = random.choice(['H', 'V'])

                if direcao == 'H' and coluna + tamanho <= self.tamanho_tabuleiro:
                    if all(tabuleiro[linha][coluna+i] == 0 for i in range(tamanho)):
                        for i in range(tamanho):
                            tabuleiro[linha][coluna+i] = 1  # Marca com '1' para navio
                        colocado = True

                elif direcao == 'V' and linha + tamanho <= self.tamanho_tabuleiro:
                    if all(tabuleiro[linha+i][coluna] == 0 for i in range(tamanho)):
                        for i in range(tamanho):
                            tabuleiro[linha+i][coluna] = 1  # Marca com '1' para navio
                        colocado = True

    def validar_coordenada_repetida(self, linha, coluna, tabuleiro):
        return (tabuleiro[linha][coluna] != 2) and (tabuleiro[linha][coluna] != 3) 


    def performar_ataque(self, linha, coluna, tabuleiro):
        # Verifica se acertou no tabuleiro, com o filtro de jogadas repetidas, aqui só pode ser 0 ou 1
        if tabuleiro[linha][coluna] == 1:
            tabuleiro[linha][coluna] = 2  # Marca como atingido
            acerto = True
        else:
            tabuleiro[linha][coluna] = 3
            acerto = False
        return acerto

    def recupera_coordenada(self, coordenada):
        letra = coordenada[0].upper() # Ex: "C"
        numero = coordenada[1:] # Ex: "1"

        linha = ord(letra) - ord('A') # Linha = índice da letra (A=0, B=1, C=2)
        coluna = int(numero) - 1 # Coluna = número (1-10) convertidos para índice 0-9
        return int(linha), int(coluna)

    def verificar_codigo_secreto(self, coordenada):
        entrada = coordenada.strip().lower()
        return entrada == self.codigo_secreto


    def forcar_vitoria_jogador(self):
        for x in range(self.tamanho_tabuleiro):
            for y in range(self.tamanho_tabuleiro):
                if self.tabuleiro_quantico[x][y] == 1:
                    self.tabuleiro_quantico[x][y] = 2

    def gerar_ataques_quanticos(self, hardware, tamanho_tabuleiro):
        jogadas = self.quantum_task.get_and_replenish_jogada(hardware, tamanho_tabuleiro)
        print(jogadas)
        
        letras = 'ABCDEFGHIJ'
        jogadas = [f"{random.choice(letras)}{random.randint(1, 10)}" for _ in range(quantidade)]
        self.pilha_ataques_quanticos = jogadas
        print(jogadas)

    def verificar_condicao_finalizacao(self, tabuleiro):
        # Verifica se todos os navios foram afundados
        for linha in tabuleiro:
            if 1 in linha:  # Se houver qualquer "1", significa que ainda há navios
                return False
        return True  # Se não houver "1" em nenhum lugar, significa que o jogo terminou
