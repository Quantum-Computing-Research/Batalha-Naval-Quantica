from .singleton_jogo import Jogo

_jogo = None

class Jogo:
    def __init__(self, tamanho_tabuleiro=10, num_navios=4):
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
        print(self.codigo_secreto)

        self.posicionar_navios(self.tabuleiro_jogador)  # Posicionando navios do jogador
        self.posicionar_navios(self.tabuleiro_quantico)  # Posicionando navios do computador
        self.gerar_ataques_quanticos()

    def get_jogo():
        global _jogo
        return _jogo

    def set_jogo(jogo):
        global _jogo
        _jogo = jogo

    def reset_jogo():
        global _jogo
        _jogo = None