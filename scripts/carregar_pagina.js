// let canvasJogador, canvasComputador, contextoJogador, contextoComputador;

// const TAMANHO_CELULA = 50;
// const TAMANHO_TABULEIRO = 500;
// 

window.onload = () => {

    console.log("📦 Página carregada — iniciando setup do jogo");
    const containerJogador = document.querySelector('.tabuleiro-jogador');
    const containerComputador = document.querySelector('.tabuleiro-computador');

    renderizarTabuleiro(containerJogador, 10, 'playerBoard');
    renderizarTabuleiro(containerComputador, 10, 'computerBoard');

    fetch(`${URL_BASE}/estado`)
        .then(res => {
            console.log("🌐 Resposta recebida da rota /estado");
            return res.json();
        })
        .then(data => {
            logBloco("📊 Dados de estado inicial carregados", data);
            atualizarRanking(data.ranking);
            atualizarFila(data.fila_espera);
        })
        .catch(err => {
            console.error("❌ Erro ao buscar estado inicial:", err);
        });
};