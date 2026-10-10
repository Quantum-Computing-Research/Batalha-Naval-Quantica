// let canvasJogador, canvasComputador, contextoJogador, contextoComputador;

// const TAMANHO_CELULA = 50;
// const TAMANHO_TABULEIRO = 500;
// 

window.onload = async () => {

    console.log("📦 Página carregada — iniciando setup do jogo");
    const containerJogador = document.querySelector('.tabuleiro-jogador');
    const containerComputador = document.querySelector('.tabuleiro-computador');

    renderizarTabuleiro(containerJogador, 10, 'playerBoard');
    renderizarTabuleiro(containerComputador, 10, 'computerBoard');

    try {
        const data = await apiFetch("/estado");
        atualizarRanking(data.ranking || []);
        atualizarFila(data.fila_espera || []);
        if (!data.em_andamento) {
            clearGameId();
            setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
            limparStatusBarEVezJogador();
            return;
        }
        document.getElementById("tamanhoTabuleiro").value = data.tamanho_tabuleiro;
        renderizarTabuleiro(containerJogador, data.tamanho_tabuleiro, "playerBoard");
        renderizarTabuleiro(containerComputador, data.tamanho_tabuleiro, "computerBoard");
        desenharNavios(data.tabuleiro_jogador);
        data.tabuleiro_jogador.forEach((row, linha) => row.forEach((cell, coluna) => {
            if (cell === 2 || cell === 3) desenharAtaqueQuantico(coluna, linha, cell === 2);
        }));
        data.ataques_jogador.forEach((row, linha) => row.forEach((cell, coluna) => {
            if (cell === 2 || cell === 3) desenharAtaqueJogador(coluna, linha, cell === 2);
        }));
        placar.jogador = data.placar.jogador || 0;
        placar.computador = data.placar.computador || 0;
        atualizarStatusBar("Partida recuperada.");
        atualizarVez(data.vez_do_jogador);
        if (!data.vez_do_jogador) ataqueComputador();
    } catch (err) {
        clearGameId();
        setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
        atualizarStatusBar(`Erro ao recuperar partida: ${err.message}`);
    }
};