function encerrarJogo() {
    const confirmacao = confirm("Tem certeza de que deseja encerrar a partida? Todos os dados do experimento serão perdidos!");
    if (!confirmacao) return;

    fetch(`${URL_BASE}/encerrar_jogo`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({})
    })
        .then(res => res.json())
        .then(() => {
            console.log("🔚 Jogo encerrado");
            document.getElementById('startButton').disabled = false;
            document.getElementById('waitButton').disabled = true;
            document.getElementById('endButton').disabled = true;

            atualizarStatusBar("");

            // Limpa barra de status e vez do jogador
            limparStatusBarEVezJogador();

            // Limpa nome jogador
            const nomeInput = document.getElementById('nomeJogadorInput');
            if (nomeInput) nomeInput.value = "";

            // Limpa tabuleiros
            const tamanho = parseInt(document.getElementById('tamanhoTabuleiro').value);

            const containerJogador = document.querySelector('.tabuleiro-jogador');
            const containerComputador = document.querySelector('.tabuleiro-computador');

            renderizarTabuleiro(containerJogador, tamanho, 'playerBoard');
            renderizarTabuleiro(containerComputador, tamanho, 'computerBoard');

            // Limpa placar
            placar.jogador = 0;
            placar.computador = 0;
        });
}