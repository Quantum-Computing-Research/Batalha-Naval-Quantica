let resultadoFinalPendente = false;
let temporizadorResultado = null;
let registroPartida = null;

function iniciarRegistroPartida(dados) {
    resultadoFinalPendente = false;
    registroPartida = { ...dados, inicio: new Date().toISOString(), historico: [] };
    guardarRegistro("qb_partida_atual", registroPartida);
}

function guardarRegistro(chave, dados) {
    try {
        localStorage.setItem(chave, JSON.stringify(dados));
    } catch (erro) {
        console.warn("Não foi possível guardar o registro local:", erro);
    }
}

function registrarJogadaPartida(tipo, coordenada, acertou) {
    if (!registroPartida) {
        try {
            registroPartida = JSON.parse(localStorage.getItem("qb_partida_atual"));
        } catch {
            return;
        }
    }
    if (!registroPartida || registroPartida.partida_id !== getGameId()) return;
    registroPartida.historico.push({ tipo, coordenada, acertou, t: new Date().toISOString() });
    guardarRegistro("qb_partida_atual", registroPartida);
}

function tabuleiroDaTela(id) {
    const tamanho = Number(document.getElementById("tamanhoTabuleiro").value);
    return Array.from({ length: tamanho }, (_, linha) => Array.from({ length: tamanho }, (_, coluna) => {
        const celula = document.querySelector(`#${id} [data-row="${linha}"][data-col="${coluna}"]`);
        if (celula?.classList.contains("acerto")) return 2;
        if (celula?.classList.contains("erro-jogador") || celula?.classList.contains("erro-quantico")) return 3;
        return celula?.classList.contains("navio") ? 1 : 0;
    }));
}

function resumoLocalPartida(data) {
    const registro = registroPartida?.partida_id === getGameId() ? registroPartida : {};
    const historico = registro.historico || [];
    const estatisticas = tipo => {
        const ataques = historico.filter(ataque => ataque.tipo === tipo || tipo === "ataque_quantico" && ataque.tipo === "ataque_classico");
        const acertos = ataques.filter(ataque => ataque.acertou).length;
        return { jogadas: ataques.length, acertos, erros: ataques.length - acertos, navios_afundados: null };
    };
    return {
        ...registro,
        partida_id: getGameId(),
        jogador: registro.jogador || sessionStorage.getItem("nomeJogador") || "Jogador",
        backend: registro.backend || getBackendSelecionado(),
        tamanho_tabuleiro: Number(document.getElementById("tamanhoTabuleiro").value),
        num_navios: Number(document.getElementById("numNavios").value),
        fim: new Date().toISOString(),
        duracao_segundos: registro.inicio ? Math.floor((Date.now() - Date.parse(registro.inicio)) / 1000) : null,
        estatisticas: { jogador: estatisticas("ataque_jogador"), computador: estatisticas("ataque_quantico") },
        tabuleiro_jogador: data.tabuleiro_jogador || tabuleiroDaTela("playerBoard"),
        tabuleiro_quantico: data.tabuleiro_quantico || tabuleiroDaTela("computerBoard"),
        historico,
    };
}

function finalizarComRegistro(data, atraso = 3000) {
    if (resultadoFinalPendente) return;
    resultadoFinalPendente = true;
    const resumo = { ...(data.resumo || resumoLocalPartida(data)), mensagem: data.mensagem };
    guardarRegistro("qb_ultimo_resultado", resumo);
    document.getElementById("tamanhoTabuleiro").value = resumo.tamanho_tabuleiro;
    document.getElementById("numNavios").value = resumo.num_navios;
    document.getElementById("dificuldade").value = resumo.dificuldade || "normal";
    atualizarChipClassico(false);
    atualizarCircuitoPartida(resumo.circuito || modeloCircuito(resumo.tamanho_tabuleiro, resumo.modo), null, resumo.backend);
    atualizarFrotaAdversaria(resumo.frota_adversaria);
    atualizarFrotaJogador(resumo.frota_jogador);
    for (const [id, seletor, board] of [
        ["playerBoard", ".tabuleiro-jogador", resumo.tabuleiro_jogador],
        ["computerBoard", ".tabuleiro-computador", resumo.tabuleiro_quantico],
    ]) {
        renderizarTabuleiro(document.querySelector(seletor), resumo.tamanho_tabuleiro, id);
        board.forEach((row, linha) => row.forEach((cell, coluna) => {
            const celula = document.querySelector(`#${id} [data-row="${linha}"][data-col="${coluna}"]`);
            if (cell === 1) celula.classList.add("navio");
            if (cell === 2) {
                celula.classList.add("acerto");
                celula.textContent = "🔥";
            }
            if (cell === 3) celula.classList.add(id === "playerBoard" ? "erro-quantico" : "erro-jogador");
        }));
    }
    placar.jogador = resumo.estatisticas.jogador.acertos;
    placar.computador = resumo.estatisticas.computador.acertos;
    setButtonsState({ startEnabled: false, waitEnabled: false, endEnabled: false });
    document.getElementById("playerMove").disabled = true;
    document.querySelector(".attack-controls button").disabled = true;
    atualizarStatusBar(data.mensagem);
    document.getElementById("vez-indicador").textContent = "Partida concluída";
    temporizadorResultado = setTimeout(() => mostrarAlertaFinal(resumo), atraso);
}

function recuperarResultadoSalvo() {
    try {
        const resumo = JSON.parse(localStorage.getItem("qb_ultimo_resultado"));
        if (!getGameId() || resumo?.partida_id !== getGameId()) return false;
        finalizarComRegistro({ resumo, mensagem: resumo.mensagem }, 0);
        return true;
    } catch {
        return false;
    }
}

function linhasResumo(resumo) {
    const duracao = resumo.duracao_segundos;
    const tempo = duracao == null ? "Não disponível" : `${Math.floor(duracao / 60)} min ${duracao % 60} s`;
    const linhas = [
        `Jogador: ${resumo.jogador}`,
        `Adversário: ${resumo.backend} | ${resumo.modo === "simulador" ? "Dados simulados" : "Cache"}`,
        `Tabuleiro: ${resumo.tamanho_tabuleiro}x${resumo.tamanho_tabuleiro} | Navios por lado: ${resumo.num_navios} | Duração: ${tempo}`,
        `Fim: ${new Date(resumo.fim).toLocaleString("pt-BR")}`,
    ];
    for (const [lado, nome] of [["jogador", "Jogador"], ["computador", "Computador"]]) {
        const stats = resumo.estatisticas[lado];
        linhas.push(`${nome}: ${stats.jogadas} jogadas | ${stats.acertos} acertos | ${stats.erros} erros | Navios afundados: ${stats.navios_afundados ?? "não disponível"}`);
    }
    return linhas;
}

async function criarImagemPartida(resumo, tabuleiros, relatorio = null) {
    const capturas = await Promise.all(tabuleiros.map(tabuleiro => htmlToImage.toCanvas(tabuleiro, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: tabuleiro.scrollWidth,
        height: tabuleiro.scrollHeight,
        skipFonts: true,
    })));
    const alturas = capturas.map(captura => captura.height * Math.min(1, 490 / captura.width));
    const complemento = relatorio ? await htmlToImage.toCanvas(relatorio, { backgroundColor: "#ffffff", pixelRatio: 2, width: relatorio.scrollWidth, height: relatorio.scrollHeight, skipFonts: true }) : null;
    const alturaComplemento = complemento ? complemento.height * (1048 / complemento.width) + 40 : 0;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    const topo = 420;
    canvas.height = topo + Math.ceil(Math.max(...alturas) + alturaComplemento) + 110;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Registro final com os dois tabuleiros e estatísticas da partida");
    const contexto = canvas.getContext("2d");
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    {
        contexto.strokeStyle = "#a18a52";
        contexto.lineWidth = 1;
        contexto.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
        contexto.strokeStyle = "#e1e5df";
        contexto.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
        contexto.textAlign = "center";
        contexto.fillStyle = "#365b49";
        contexto.font = "18px Georgia";
        contexto.fillText("BATALHA NAVAL QUÂNTICA", 600, 72);
        contexto.fillStyle = "#252c28";
        contexto.font = "42px Georgia";
        contexto.fillText("Registro de partida", 600, 128);
        contexto.font = "italic 20px Georgia";
        contexto.fillStyle = "#626a64";
        contexto.fillText(resumo.mensagem || "Partida concluída", 600, 166, 1040);
        contexto.font = "bold 34px Georgia";
        contexto.fillStyle = "#252c28";
        contexto.fillText(resumo.jogador, 600, 218, 1040);
        contexto.font = "17px Georgia";
        contexto.fillStyle = "#626a64";
        const tempo = formatarDuracaoPartida(resumo.duracao_segundos);
        contexto.fillText(`${nomeHardwarePartida(resumo.backend)}  ·  ${resumo.modo === "simulador" ? "Dados simulados" : "Cache"}  ·  ${resumo.dificuldade === "plus" ? "Plus" : "Quântico"}  ·  ${resumo.tamanho_tabuleiro} × ${resumo.tamanho_tabuleiro}  ·  ${tempo}`, 600, 254, 1040);
        contexto.textAlign = "left";
        for (const [lado, nome, esquerda] of [["jogador", "Jogador", 76], ["computador", "Computador", 652]]) {
            const stats = resumo.estatisticas[lado];
            contexto.fillStyle = "#365b49";
            contexto.font = "bold 18px Georgia";
            contexto.fillText(nome, esquerda, 314);
            contexto.fillStyle = "#252c28";
            contexto.font = "22px Georgia";
            contexto.fillText(`${stats.jogadas} jogadas   /   ${stats.acertos} acertos   /   ${stats.erros} erros`, esquerda, 348, 490);
            contexto.fillStyle = "#626a64";
            contexto.font = "17px Georgia";
            contexto.fillText(`${stats.navios_afundados ?? "—"} navios afundados de ${resumo.num_navios}`, esquerda, 376);
        }
        contexto.fillStyle = "#626a64";
        contexto.font = "14px Georgia";
        contexto.fillText(`Concluída em ${new Date(resumo.fim).toLocaleString("pt-BR")}`, 76, canvas.height - 49);
        contexto.textAlign = "right";
        contexto.fillText(`Partida ${resumo.partida_id}`, 1124, canvas.height - 49, 560);
        contexto.textAlign = "left";
    }
    const desenhar = (captura, esquerda, titulo) => {
        contexto.fillStyle = "#252c28";
        contexto.font = "bold 20px Georgia";
        contexto.fillText(titulo, esquerda, topo);
        const escala = Math.min(1, 490 / captura.width);
        contexto.drawImage(captura, esquerda, topo + 20, captura.width * escala, captura.height * escala);
    };
    desenhar(capturas[0], 76, "Seu tabuleiro");
    desenhar(capturas[1], 652, "Tabuleiro do adversário");
    if (complemento) contexto.drawImage(complemento, 76, topo + Math.max(...alturas) + 50, 1048, complemento.height * (1048 / complemento.width));
    return canvas;
}

function formatarDuracaoPartida(segundos) {
    return segundos == null ? "Duração indisponível" : `${Math.floor(segundos / 60)} min ${segundos % 60} s`;
}

function nomeHardwarePartida(backend) {
    return {
        iqm_garnet: "IQM Garnet", quera_aquila: "QuEra Aquila", rigetti_ankaa: "Rigetti Ankaa",
        ionq_aria2: "IonQ Aria 2", ionq_forti1: "IonQ Forte 1", simulador: "Simulador",
    }[backend] || backend;
}

function baixarRegistro(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mostrarAlertaFinal(resumo) {
    document.getElementById("alerta-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "alerta-overlay";
    const alerta = document.createElement("section");
    alerta.id = "alerta-container";
    alerta.setAttribute("role", "dialog");
    alerta.setAttribute("aria-modal", "true");
    alerta.setAttribute("aria-labelledby", "resultado-titulo");
    const cabecalho = document.createElement("header");
    cabecalho.className = "certificado-cabecalho";
    const marca = document.createElement("p");
    marca.className = "certificado-marca";
    marca.textContent = "Batalha Naval Quântica";
    const titulo = document.createElement("h2");
    titulo.id = "resultado-titulo";
    titulo.textContent = "Registro de partida";
    const resultado = document.createElement("p");
    resultado.className = "certificado-resultado";
    resultado.textContent = resumo.mensagem || "Partida concluída";
    const jogador = document.createElement("p");
    jogador.className = "certificado-jogador";
    jogador.textContent = resumo.jogador;
    cabecalho.append(marca, titulo, resultado, jogador);
    alerta.appendChild(cabecalho);
    const detalhes = document.createElement("div");
    detalhes.className = "resultado-detalhes";
    for (const [label, valor] of [
        ["Dificuldade", resumo.dificuldade === "plus" ? "Plus · quântico + clássico" : "Quântico"],
        ["Adversário", nomeHardwarePartida(resumo.backend)],
        ["Origem dos dados", resumo.modo === "simulador" ? "Dados simulados" : "Cache"],
        ["Tabuleiro", `${resumo.tamanho_tabuleiro} × ${resumo.tamanho_tabuleiro}`],
        ["Duração", formatarDuracaoPartida(resumo.duracao_segundos)],
    ]) {
        const item = document.createElement("p");
        const legenda = document.createElement("span");
        legenda.textContent = label;
        const texto = document.createElement("strong");
        texto.textContent = valor;
        item.append(legenda, texto);
        detalhes.appendChild(item);
    }
    alerta.appendChild(detalhes);
    const estatisticas = document.createElement("div");
    estatisticas.className = "certificado-estatisticas";
    for (const [lado, nome] of [["jogador", "Jogador"], ["computador", "Computador"]]) {
        const bloco = document.createElement("section");
        const nomeLado = document.createElement("h3");
        nomeLado.textContent = nome;
        const lista = document.createElement("dl");
        const stats = resumo.estatisticas[lado];
        for (const [label, valor] of [["Jogadas", stats.jogadas], ["Acertos", stats.acertos], ["Erros", stats.erros], ["Navios afundados", `${stats.navios_afundados ?? "—"} / ${resumo.num_navios}`]]) {
            const item = document.createElement("div");
            const legenda = document.createElement("dt");
            legenda.textContent = label;
            const numero = document.createElement("dd");
            numero.textContent = valor;
            item.append(numero, legenda);
            lista.appendChild(item);
        }
        bloco.append(nomeLado, lista);
        estatisticas.appendChild(bloco);
    }
    alerta.appendChild(estatisticas);
    const tabuleiros = document.createElement("div");
    tabuleiros.className = "certificado-tabuleiros";
    const copias = [];
    for (const [id, titulo] of [["playerBoard", "Seu tabuleiro"], ["computerBoard", "Tabuleiro do adversário"]]) {
        const bloco = document.createElement("section");
        const nome = document.createElement("h3");
        nome.textContent = titulo;
        const area = document.createElement("div");
        area.className = "certificado-tabuleiro-area";
        area.tabIndex = 0;
        area.setAttribute("role", "region");
        area.setAttribute("aria-label", titulo);
        const copia = document.getElementById(id).cloneNode(true);
        copia.removeAttribute("id");
        copia.querySelectorAll("[id]").forEach(elemento => elemento.removeAttribute("id"));
        copia.className = "certificado-tabuleiro";
        copias.push(copia);
        area.appendChild(copia);
        bloco.append(nome, area);
        tabuleiros.appendChild(bloco);
    }
    alerta.appendChild(tabuleiros);
    const relatorio = document.createElement("div");
    relatorio.className = "certificado-relatorio";
    relatorio.append(criarDiagramaCircuito(resumo.circuito || modeloCircuito(resumo.tamanho_tabuleiro, resumo.modo)), criarAnalisePartida(resumo.analise));
    if (resumo.dificuldade === "plus") {
        const fontes = document.createElement("p");
        fontes.textContent = `Ataques quânticos: ${resumo.ataques_por_fonte?.quantico ?? "—"} · Ataques clássicos: ${resumo.ataques_por_fonte?.classico ?? "—"}`;
        const chip = document.getElementById("chipClassico").cloneNode(true);
        chip.removeAttribute("id");
        chip.hidden = false;
        relatorio.append(fontes, chip);
    }
    alerta.appendChild(relatorio);
    const rodape = document.createElement("footer");
    rodape.className = "certificado-rodape";
    const data = document.createElement("span");
    data.textContent = new Date(resumo.fim).toLocaleString("pt-BR");
    const identificador = document.createElement("span");
    identificador.textContent = `Partida ${resumo.partida_id}`;
    rodape.append(data, identificador);
    alerta.appendChild(rodape);
    const acoes = document.createElement("div");
    acoes.className = "resultado-acoes";
    const imagem = document.createElement("button");
    imagem.textContent = "Baixar certificado PNG";
    const erroImagem = document.createElement("p");
    erroImagem.setAttribute("role", "status");
    imagem.onclick = async () => {
        imagem.disabled = true;
        imagem.textContent = "Preparando certificado...";
        erroImagem.textContent = "";
        try {
            const canvas = await criarImagemPartida(resumo, copias, relatorio);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("Falha na captura dos tabuleiros");
            baixarRegistro(blob, `partida-${resumo.partida_id}.png`);
        } catch (erro) {
            erroImagem.textContent = "Não foi possível capturar a imagem. Tente novamente ou baixe os dados JSON.";
            console.error("Erro ao capturar certificado:", erro);
        } finally {
            imagem.disabled = false;
            imagem.textContent = "Baixar certificado PNG";
        }
    };
    const dados = document.createElement("button");
    dados.textContent = "Baixar dados JSON";
    dados.onclick = () => baixarRegistro(new Blob([JSON.stringify(resumo, null, 2)], { type: "application/json" }), `partida-${resumo.partida_id}.json`);
    const nova = document.createElement("button");
    nova.textContent = "Nova partida";
    nova.onclick = async () => {
        nova.disabled = true;
        await encerrarJogo({ silentConfirm: true });
        overlay.remove();
        document.getElementById("startButton").focus();
    };
    acoes.append(imagem, dados, nova);
    alerta.appendChild(acoes);
    alerta.appendChild(erroImagem);
    overlay.appendChild(alerta);
    document.body.appendChild(overlay);
    imagem.focus();
    alerta.addEventListener("keydown", event => {
        if (event.key !== "Tab") return;
        const botoes = [...alerta.querySelectorAll("button, [tabindex='0']")].filter(botao => !botao.disabled);
        if (event.shiftKey && document.activeElement === botoes[0]) {
            event.preventDefault();
            botoes.at(-1).focus();
        } else if (!event.shiftKey && document.activeElement === botoes.at(-1)) {
            event.preventDefault();
            botoes[0].focus();
        }
    });
}