let placar = {
    jogador: 0,
    computador: 0
};

function iniciarJogo(nome) {
    const numNavios = parseInt(document.getElementById("numNavios").value);
    const tamanhoTabuleiro = parseInt(document.getElementById("tamanhoTabuleiro").value);

    const backendCard = document.querySelector(".card.selecionado");
    const backend = backendCard?.dataset?.backend || backendCard?.id || "default";

    apiFetch("/iniciar_jogo", {
        method: "POST",
        body: { nome, backend, num_navios: numNavios, tamanho_tabuleiro: tamanhoTabuleiro }
    })
        .then(data => {
            setGameId(data.game_id);              // <<< essencial
            atualizarStatusBar(`Jogo em andamento. Jogador: ${nome}`);
            document.getElementById('startButton').disabled = true;
            document.getElementById('waitButton').disabled = false;
            document.getElementById('endButton').disabled = false;

            atualizarVez(true);
            desenharNavios(data.tabuleiro_jogador);
            atualizarRanking(data.ranking);
            atualizarFila(data.fila_espera);

            const input = document.getElementById("playerMove");
            input.focus();
            input.select();
        })
        .catch(err => alert(`Erro ao iniciar: ${err.message}`));
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

function encerrarJogo() {
    const confirmacao = confirm("Tem certeza de que deseja encerrar a partida? Todos os dados do experimento serão perdidos!");
    if (!confirmacao) return;

    apiFetch("/encerrar_jogo", { method: "POST", body: {} })
        .then(() => {
            clearGameId(); // <<< essencial
            console.log("🔚 Jogo encerrado");
            document.getElementById('startButton').disabled = false;
            document.getElementById('waitButton').disabled = true;
            document.getElementById('endButton').disabled = true;

            atualizarStatusBar("");
            limparStatusBarEVezJogador();

            const nomeInput = document.getElementById('nomeJogadorInput');
            if (nomeInput) nomeInput.value = "";

            const tamanho = parseInt(document.getElementById('tamanhoTabuleiro').value);
            renderizarTabuleiro(document.querySelector('.tabuleiro-jogador'), tamanho, 'playerBoard');
            renderizarTabuleiro(document.querySelector('.tabuleiro-computador'), tamanho, 'computerBoard');

            placar.jogador = 0;
            placar.computador = 0;
        })
        .catch(err => alert(`Erro ao encerrar: ${err.message}`));
}

function cancelarJogo() {
    alert("Jogo encerrado. Obrigado pela visita!");// ou sua landing page
    document.getElementById("consentimentoModal").style.display = "none";
}

function atualizarStatusBar(texto) {
    const barra = document.getElementById('statusBar');
    barra.innerText = `${texto}
🎯 Placar → Jogador: ${placar.jogador}  |  Computador: ${placar.computador}`;
    console.log("📢 StatusBar:", barra.innerText);
}

function atualizarVez(vezDoJogador) {
    const vezDiv = document.getElementById("vez-indicador");
    if (vezDoJogador) {
        vezDiv.innerHTML = "🟢 Sua vez de atacar!";
        vezDiv.className = "vez-status vez-jogador";
    } else {
        vezDiv.innerHTML = "⏳ Esperando ataque quântico...";
        vezDiv.className = "vez-status vez-computador";
    }
}

function limparStatusBarEVezJogador() {
    const barra = document.getElementById('statusBar');
    barra.innerText = "";

    const vezDiv = document.getElementById("vez-indicador");
    vezDiv.innerHTML = "⏳";
    vezDiv.className = "vez-status";
}


function atacar() {
    const coordenada = document.getElementById("playerMove").value.trim();
    if (!coordenada) return alert("Digite uma coordenada válida!");

    apiFetch("/atacar", { method: "POST", body: { coordenada } })
        .then(data => {
            const letra = coordenada[0].toUpperCase();
            const numero = parseInt(coordenada.slice(1));
            const x = numero - 1;
            const y = letra.charCodeAt(0) - 65;
            desenharAtaqueJogador(x, y, data.status === "acerto");

            if (data.status === "acerto") placar.jogador++;
            atualizarStatusBar(`Você atacou ${coordenada.toUpperCase()} → ${data.mensagem}`);
            processarRespostaAtaqueJogador(data);

            if (data.finalizado === true || data.finalizado === "true") {
                mostrarAlertaFinal(data.mensagem);
                if (data.tabuleiro_quantico) desenharTabuleiroAdversario(data.tabuleiro_quantico);
                encerrarJogo(); // vai limpar game_id
                return;
            }
            document.getElementById("playerMove").value = "";
        })
        .catch(err => alert(`Erro no ataque: ${err.message}`));
}

function ataqueComputador() {
    apiFetch("/ataque-quantico")
        .then(data => {
            const [linha, coluna] = data.jogada_quantica;
            const acertou = data.status === "acerto";

            desenharAtaqueQuantico(coluna, linha, acertou);
            atualizarStatusBar(data.mensagem);
            atualizarVez(data.vez_do_jogador);

            if (acertou) placar.computador++;

            if (data.finalizado === true) {
                if (data.tabuleiro_quantico) desenharTabuleiroAdversario(data.tabuleiro_quantico);
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        mostrarAlertaFinal(data.mensagem);
                        encerrarJogo();
                    }, 3300);
                });
                return;
            }
            if (!data.vez_do_jogador) setTimeout(ataqueComputador, 600);
        })
        .catch(err => alert(`Erro no ataque quântico: ${err.message}`));
}

function getGameId() {
    return localStorage.getItem("qb_game_id");
}

function setGameId(id) {
    localStorage.setItem("qb_game_id", id);
}

function clearGameId() {
    localStorage.removeItem("qb_game_id");
}

function apiFetch(path, { method = "GET", body = null } = {}) {
    const gameId = getGameId();
    const headers = { "Content-Type": "application/json" };
    if (gameId) headers["x-game-id"] = gameId;

    return fetch(`${URL_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
}