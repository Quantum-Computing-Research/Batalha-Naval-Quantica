function desenharNavios(tabuleiro) {
    const board = document.getElementById('playerBoard');
    for (let i = 0; i < tabuleiro.length; i++) {
        for (let j = 0; j < tabuleiro[i].length; j++) {
            if (tabuleiro[i][j] === 1) {
                const celula = board.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                celula.classList.add('navio');
            }
        }
    }
}
