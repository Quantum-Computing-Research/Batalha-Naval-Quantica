let placar = {
    jogador: 0,
    computador: 0
};

function iniciarJogo(nome) {

    const numNavios = parseInt(document.getElementById("numNavios").value);
    const tamanhoTabuleiro = parseInt(document.getElementById("tamanhoTabuleiro").value);
    const backendSelecionado = document.querySelector('.card.selecionado');
    const input = document.getElementById("playerMove");

    logBloco("🚀 Enviando dados para iniciar o jogo", {
        nome,
        backend: backendSelecionado,
        num_navios: numNavios,
        tamanho_tabuleiro: tamanhoTabuleiro
    });


    fetch(`${URL_BASE}/iniciar_jogo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, backend: backendSelecionado, num_navios: numNavios, tamanho_tabuleiro: tamanhoTabuleiro })
    })
        .then(res => res.json())
        .then(data => {
            logBloco("✅ Jogo iniciado com sucesso", data);
            atualizarStatusBar(`Jogo em andamento. Jogador: ${nome}`);
            document.getElementById('startButton').disabled = true;
            document.getElementById('waitButton').disabled = false;
            document.getElementById('endButton').disabled = false;
            atualizarVez(true)
            desenharNavios(data.tabuleiro_jogador)
            atualizarRanking(data.ranking);
            atualizarFila(data.fila_espera);
            input.focus();
            input.select();
        });
}

document.getElementById("confirmarConsentimento").addEventListener("click", function () {
    const nome = document.getElementById("nomeJogadorInput").value.trim();
    if (!nome) {
        alert("Digite seu nome para continuar.");
        return;
    }

    sessionStorage.setItem("nomeJogador", nome);
    document.getElementById("consentimentoModal").style.display = "none";

    iniciarJogo(nome);
});

document.getElementById("cancelarConsentimento").addEventListener("click", function () {
    document.getElementById("consentimentoModal").style.display = "none";
});

