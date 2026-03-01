window.addEventListener("load", () => {
    const gameId = getGameId();
    if (!gameId) return;

    apiFetch("/estado")
        .then(st => {
            if (!st.em_andamento) {
                clearGameId();
                return;
            }
            atualizarStatusBar(`Jogo retomado. Jogador: ${st.jogador}`);
            document.getElementById('startButton').disabled = true;
            document.getElementById('waitButton').disabled = false;
            document.getElementById('endButton').disabled = false;
            // aqui você pode chamar também um endpoint de “snapshot” se quiser redesenhar tabuleiro
        })
        .catch(() => clearGameId());
});