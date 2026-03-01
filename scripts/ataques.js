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


function processarRespostaAtaqueJogador(data) {
    atualizarVez(data.vez_do_jogador);

    if (!data.vez_do_jogador) {
        setTimeout(() => ataqueComputador(), 850);
    }
}