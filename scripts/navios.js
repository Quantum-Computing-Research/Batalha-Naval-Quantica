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

let frotaAdversariaAtual = null;

function renderizarFrota(frota, listaId, resumoId) {
    const lista = document.getElementById(listaId);
    const resumo = document.getElementById(resumoId);
    lista.replaceChildren();
    if (!Array.isArray(frota)) {
        resumo.textContent = "Frota indisponível nesta partida";
        return;
    }
    const afundados = frota.filter(navio => navio.afundado).length;
    resumo.textContent = frota.length ? `${afundados} de ${frota.length} afundados` : "Nenhuma partida ativa";
    [...frota].sort((primeiro, segundo) => segundo.tamanho - primeiro.tamanho).forEach(navio => {
        const item = document.createElement("li");
        item.dataset.navioId = navio.id;
        item.className = navio.afundado ? "frota-navio afundado" : "frota-navio";
        const silhueta = document.createElement("div");
        silhueta.className = "frota-silhueta";
        const imagem = document.createElement("img");
        imagem.src = "assets/img/frota-navio.svg";
        imagem.alt = "";
        imagem.width = 120;
        imagem.height = 32;
        imagem.style.width = `${Math.min(120, 46 + navio.tamanho * 13)}px`;
        silhueta.appendChild(imagem);
        const status = document.createElement("span");
        status.className = "frota-navio-status";
        status.textContent = navio.afundado ? "Afundado" : "Em combate";
        item.append(silhueta, status);
        lista.appendChild(item);
    });
}

function atualizarFrotaJogador(frota) {
    renderizarFrota(frota, "frota-jogador-lista", "frota-jogador-resumo");
    if (typeof registroPartida !== "undefined" && registroPartida) {
        registroPartida.frota_jogador = frota;
        guardarRegistro("qb_partida_atual", registroPartida);
    }
}

function atualizarFrotaAdversaria(frota) {
    frotaAdversariaAtual = frota ?? null;
    renderizarFrota(frota, "frota-lista", "frota-resumo");
    if (typeof registroPartida !== "undefined" && registroPartida) {
        registroPartida.frota_adversaria = frota;
        guardarRegistro("qb_partida_atual", registroPartida);
    }
}

function marcarNavioAfundado(navio) {
    if (!navio) return;
    for (const coordenada of navio.coordenadas || []) {
        const linha = coordenada.charCodeAt(0) - 65;
        const coluna = Number(coordenada.slice(1)) - 1;
        const celula = document.querySelector(`#computerBoard [data-row="${linha}"][data-col="${coluna}"]`);
        if (celula) {
            celula.classList.add("navio-afundado");
            celula.title = "Navio afundado";
        }
    }
}
