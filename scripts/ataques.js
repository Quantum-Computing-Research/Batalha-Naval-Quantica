function desenharAtaqueQuantico(x, y, acertou) {
    const board = document.getElementById('playerBoard');
    const celula = board.querySelector(`[data-row="${y}"][data-col="${x}"]`);

    if (acertou) {
        celula.textContent = '🔥';
        celula.classList.add('acerto');
    } else {
        celula.classList.add('erro-quantico');
    }
}

// Exemplo sem canvas, manipulando DOM diretamente:
function desenharAtaqueJogador(x, y, acertou) {
    const board = document.getElementById('computerBoard');
    const celula = board.querySelector(`[data-row="${y}"][data-col="${x}"]`);

    if (!celula) {
        console.warn(`❗Célula não encontrada para x=${x}, y=${y}`);
        return; // impede erro
    }

    if (acertou) {
        celula.textContent = '🔥';
        celula.classList.add('acerto');
    } else {
        celula.classList.add('erro-jogador');
    }
}

function atacar() {
    const coordenada = document.getElementById("playerMove").value.trim();
    if (!coordenada) return alert("Digite uma coordenada válida!");

    fetch(`${URL_BASE}/atacar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordenada })
    })
        .then(res => res.json())
        .then(data => {
            logBloco("🎯 Resultado do ataque:", data);

            const letra = coordenada[0].toUpperCase();
            const numero = parseInt(coordenada.slice(1));
            const x = numero - 1;
            const y = letra.charCodeAt(0) - 65;
            desenharAtaqueJogador(x, y, data.status === "acerto");

            if (data.status === "acerto") placar.jogador++;

            atualizarStatusBar(`Você atacou ${coordenada.toUpperCase()} → ${data.mensagem}`);
            processarRespostaAtaqueJogador(data);
            if (data.finalizado === true || data.finalizado === "true" || data.finalizado == true || data.finalizado == "true") {
                mostrarAlertaFinal(data.mensagem)
                desenharTabuleiroAdversario(data.tabuleiro_quantico);
                encerrarJogo()
                return;
            }
            document.getElementById("playerMove").value = "";
        });
}

function ataqueComputador() {
    fetch(`${URL_BASE}/ataque-quantico`)
        .then(res => res.json())
        .then(data => {
            const [linha, coluna] = data.jogada_quantica;
            const acertou = data.status === "acerto";
            desenharAtaqueQuantico(coluna, linha, acertou);
            atualizarStatusBar(data.mensagem);
            atualizarVez(data.vez_do_jogador);

            if (data.status === "acerto") placar.computador++;


            if (data.finalizado === true) {
                desenharTabuleiroAdversario(data.tabuleiro_quantico);
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        mostrarAlertaFinal(data.mensagem);
                        encerrarJogo();
                    }, 3300); // tempo reduzido só para dar tempo do repaint
                });// pequeno delay para o tabuleiro ser redesenhado antes do alerta
                return;
            }

            if (!data.vez_do_jogador) {
                setTimeout(ataqueComputador, 600);
            }
        });
}

function processarRespostaAtaqueJogador(data) {
    atualizarVez(data.vez_do_jogador);

    if (!data.vez_do_jogador) {
        setTimeout(() => ataqueComputador(), 850);
    }
}