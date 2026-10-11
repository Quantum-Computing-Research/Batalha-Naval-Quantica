let backendSelecionado = null;

function selecionarBackend(backend) {
    backendSelecionado = backend;
    const ids = ['sv1', 'dm1', 'tn1'];
    ids.forEach(id => {
        const img = document.getElementById(`img-${id}`);
        img.classList.toggle("selected", id === backend);
    });
}

let circuitoAtual = null;
let hardwareCircuitoAtual = null;
let estadoChipClassico = { ativo: false, coordenada: null, executando: false };

function criarLeituraJogada(coordenada, bitsPorEixo, ativa) {
    const leitura = document.createElement("div");
    leitura.className = ativa && coordenada ? "circuito-jogada" : "circuito-jogada sem-jogada";
    leitura.setAttribute("aria-live", "polite");
    if (!(ativa && coordenada)) leitura.setAttribute("aria-hidden", "true");
    const binario = document.createElement("span");
    binario.className = "circuito-jogada-binario";
    const coordenadaFormatada = document.createElement("span");
    coordenadaFormatada.className = "circuito-jogada-coordenada";
    if (coordenada) {
        const linha = coordenada.charCodeAt(0) - 65;
        const coluna = Number(coordenada.slice(1)) - 1;
        binario.textContent = `${linha.toString(2).padStart(bitsPorEixo, "0")} | ${coluna.toString(2).padStart(bitsPorEixo, "0")}`;
        coordenadaFormatada.textContent = coordenada;
    }
    leitura.append(binario, coordenadaFormatada);
    return leitura;
}

function atualizarBotaoPlus() {
    const botao = document.getElementById("dificuldade");
    const selecionado = botao.value === "plus";
    botao.setAttribute("aria-pressed", String(selecionado));
    botao.setAttribute("aria-label", selecionado ? "Desativar ajuda clássica Plus" : "Ativar ajuda clássica Plus");
}

function atualizarChipClassico(ativo = false, coordenada = null, executando = false) {
    atualizarBotaoPlus();
    if (executando) document.getElementById("circuitoPartida").classList.remove("quantico-executando");
    estadoChipClassico = { ativo, coordenada: coordenada || estadoChipClassico.coordenada, executando };
    const area = document.getElementById("chipClassico");
    area.hidden = document.getElementById("dificuldade").value !== "plus";
    if (area.hidden) return;
    area.replaceChildren();
    area.classList.toggle("chip-ativo", ativo);
    area.classList.toggle("chip-executando", executando);
    const bits = circuitoAtual?.qubits_total || 2 * Math.log2(Number(document.getElementById("tamanhoTabuleiro").value));
    area.style.setProperty("--qubits-total", bits);
    const alturaCircuito = bits * 32;
    document.querySelector(".partida-chips").style.setProperty("--qubits-total", bits);
    const composicao = document.createElement("div");
    composicao.className = "circuito-diagrama chip-diagrama";
    composicao.style.gridTemplateColumns = "minmax(0, 30%) minmax(0, 1fr) clamp(64px, 8vw, 104px)";
    const figuraChip = document.createElement("figure");
    figuraChip.className = "chip-hardware";
    figuraChip.setAttribute("aria-label", "Computador clássico");
    const imagemChip = document.createElement("img");
    imagemChip.src = "assets/img/chip-classico.svg";
    imagemChip.alt = "Microprocessador clássico quadrado com terminais metálicos";
    imagemChip.width = 120;
    imagemChip.height = 100;
    figuraChip.appendChild(imagemChip);
    const coord = estadoChipClassico.coordenada;
    const eixo = bits / 2;
    const leitura = criarLeituraJogada(coord, eixo, Boolean(coord));
    const sequencia = coord
        ? [(coord.charCodeAt(0) - 65).toString(2).padStart(eixo, "0"), (Number(coord.slice(1)) - 1).toString(2).padStart(eixo, "0")].join("")
        : null;
    const diagrama = document.createElement("div");
    diagrama.className = "chip-rede";
    diagrama.style.gridTemplateColumns = "0 minmax(0, 1fr)";
    const altura = alturaCircuito;
    diagrama.style.height = `${altura}px`;
    const fios = [];
    const portas = [];
    composicao.style.gridTemplateColumns = "minmax(0, 25.5%) minmax(0, 1fr) clamp(64px, 8vw, 104px)";
    for (let camada = 0; camada < 3; camada++) {
        const esquerda = 30 + camada * 76;
        for (let indice = 0; indice < bits; indice++) {
            const centro = indice * 32 + 16;
            if (camada === 0) {
                const bifurcacao = esquerda - 12;
                fios.push(`<path d="M18 ${centro}H${bifurcacao}V${centro - 5}H${esquerda}M${bifurcacao} ${centro}V${centro + 5}H${esquerda}"/>`);
            } else {
                const saidaAnteriorX = esquerda - 46;
                const fontes = [indice, (indice + 1) % bits];
                fontes.forEach((fonte, entrada) => {
                    const yOrigem = fonte * 32 + 16;
                    const yDestino = centro + (entrada === 0 ? -5 : 5);
                    const rotaX = saidaAnteriorX + 12 + entrada * 10;
                    fios.push(`<path d="M${saidaAnteriorX} ${yOrigem}H${rotaX}V${yDestino}H${esquerda}"/>`);
                });
            }
            portas.push(`<path d="M${esquerda} ${centro - 9}h15a9 9 0 0 1 0 18h-15z" fill="#d5eafa"/><circle cx="${esquerda + 27}" cy="${centro}" r="3" fill="#fff"/>`);
            if (camada === 2) {
                fios.push(`<path d="M${esquerda + 30} ${centro}H220"/>`);
                saidas.push(`<text x="226" y="${centro + 4}" fill="#365b49" stroke="none" font-family="monospace" font-size="11">${sequencia ? sequencia[indice] : "—"}</text>`);
            }
        }
    }
    const rede = document.createElement("img");
    rede.className = "chip-rede-imagem";
    rede.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 ${altura}" fill="none" stroke="#516b78" stroke-width="1.3">${fios.join("")}${portas.join("")}${saidas.join("")}</svg>`)}`;
    rede.alt = `Circuito clássico ilustrativo com ${bits} entradas e portas NAND interligadas`;
    rede.width = 256;
    rede.height = altura;
    const entradas = document.createElement("div");
    entradas.className = "chip-bits-entrada";
    for (let indice = 0; indice < bits; indice++) {
        const entrada = document.createElement("span");
        entrada.className = "chip-bit-rotulo";
        entrada.textContent = `b${indice}`;
        entradas.appendChild(entrada);
    }
    const areaRede = document.createElement("div");
    areaRede.className = "chip-rede-scroll";
    areaRede.appendChild(rede);
    diagrama.append(entradas, areaRede);
    composicao.append(figuraChip, diagrama, leitura);
    area.appendChild(composicao);
}

function modeloCircuito(tamanho, modo = "simulador") {
    const bits = Math.log2(tamanho);
    if (!Number.isInteger(bits)) return null;
    return {
        qubits_por_eixo: bits,
        qubits_total: bits * 2,
        probabilidade_celula: `1/${tamanho * tamanho}`,
        origem: modo === "simulador" ? "Dados sintéticos · v0" : "Cache · circuito de referência, execução não verificada",
        execucao_qpu: false,
    };
}

function criarDiagramaCircuito(circuito, coordenada = null) {
    const composicao = document.createElement("div");
    composicao.className = "circuito-saida-e-rede";
    composicao.style.gridTemplateColumns = "minmax(0, 1fr) clamp(64px, 8vw, 104px)";
    const diagrama = document.createElement("div");
    diagrama.className = "circuito-diagrama";
    if (!circuito) return composicao;
    const bits = circuito.qubits_por_eixo;
    const leitura = criarLeituraJogada(coordenada, bits, !!coordenada);
    const alturaCircuito = circuito.qubits_total * 32;
    diagrama.style.height = `${alturaCircuito}px`;
    const grupos = document.createElement("div");
    grupos.className = "circuito-grupos";
    grupos.style.height = `${alturaCircuito}px`;
    const medicao = coordenada
        ? [coordenada.charCodeAt(0) - 65, Number(coordenada.slice(1)) - 1]
            .map(valor => valor.toString(2).padStart(bits, "0"))
        : null;
    const sequencia = medicao?.join("");
    for (let indice = 0; indice < circuito.qubits_total; indice++) {
        const linha = document.createElement("div");
        linha.className = "circuito-qubit";
        const rotulo = document.createElement("span");
        rotulo.textContent = `q${indice} |0⟩`;
        const fio = document.createElement("div");
        fio.className = "circuito-fio";
        const porta = document.createElement("span");
        porta.className = "circuito-porta";
        porta.textContent = "H";
        const medir = document.createElement("span");
        medir.className = "circuito-porta circuito-medicao";
        const visor = lucide.createElement(lucide.icons.Gauge);
        visor.setAttribute("aria-hidden", "true");
        medir.appendChild(visor);
        medir.setAttribute("role", "img");
        medir.setAttribute("aria-label", "Medição");
        fio.append(porta, medir);
        const valor = document.createElement("span");
        valor.className = "circuito-bit";
        valor.textContent = sequencia ? sequencia[indice] : "—";
        linha.append(rotulo, fio, valor);
        grupos.appendChild(linha);
    }
    diagrama.appendChild(grupos);
    composicao.append(diagrama, leitura);
    return composicao;
}

function atualizarCircuitoPartida(circuito, coordenada = null, backend = null) {
    circuitoAtual = circuito || modeloCircuito(Number(document.getElementById("tamanhoTabuleiro").value));
    document.querySelector("#circuitoPartida").style.setProperty("--qubits-total", circuitoAtual.qubits_total);
    document.querySelector(".partida-chips").style.setProperty("--qubits-total", circuitoAtual.qubits_total);
    if (backend) hardwareCircuitoAtual = backend;
    const hardware = hardwareCircuitoAtual || document.querySelector('.card.selecionado')?.dataset.backend;
    const card = [...document.querySelectorAll('.card[data-backend]')].find(item => item.dataset.backend === hardware);
    const composicao = document.createElement('div');
    composicao.className = 'circuito-com-hardware';
    if (card) {
        const figura = document.createElement('figure');
        figura.className = 'circuito-hardware';
        const imagem = card.querySelector('img').cloneNode(true);
        imagem.width = 140;
        imagem.height = 120;
        figura.setAttribute("aria-label", card.querySelector('h3').textContent);
        figura.append(imagem);
        composicao.appendChild(figura);
    } else {
        const placeholder = document.createElement("div");
        placeholder.className = "circuito-hardware circuito-hardware-pendente";
        placeholder.setAttribute("role", "img");
        placeholder.setAttribute("aria-label", "Selecione um computador quântico");
        const interrogacao = document.createElement("span");
        interrogacao.setAttribute("aria-hidden", "true");
        interrogacao.textContent = "?";
        placeholder.appendChild(interrogacao);
        composicao.appendChild(placeholder);
    }
    composicao.appendChild(criarDiagramaCircuito(circuitoAtual, coordenada));
    document.getElementById("circuitoPartida").replaceChildren(composicao);
}

function criarAnalisePartida(analise) {
    const bloco = document.createElement("section");
    bloco.className = "certificado-analise";
    const titulo = document.createElement("h3");
    titulo.textContent = "Análise das medições";
    bloco.appendChild(titulo);
    const nota = document.createElement("p");
    if (!analise?.disponivel) {
        nota.textContent = analise?.motivo || "Medições brutas indisponíveis nesta versão da partida.";
        bloco.appendChild(nota);
        return bloco;
    }
    const formato = valor => valor == null ? "Indisponível" : Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    const lista = document.createElement("dl");
    for (const [nome, valor] of [
        ["Medições brutas", analise.amostras], ["Repetições", analise.repeticoes],
        ["Esperado por célula", analise.esperado_por_celula], ["χ² (descritivo)", analise.qui_quadrado],
        ["Graus de liberdade", analise.graus_liberdade], ["Entropia (bits)", analise.entropia_bits],
        ["Entropia máxima (bits)", analise.entropia_maxima_bits], ["Correlação lag 1", analise.correlacao_lag_1],
    ]) {
        const item = document.createElement("div");
        const label = document.createElement("dt");
        label.textContent = nome;
        const numero = document.createElement("dd");
        numero.textContent = formato(valor);
        item.append(label, numero);
        lista.appendChild(item);
    }
    bloco.appendChild(lista);
    const grafico = document.createElement("div");
    grafico.className = "medicoes-histograma";
    grafico.setAttribute("role", "img");
    grafico.setAttribute("aria-label", "Frequências por célula, em ordem de linha e coluna; linha horizontal indica frequência esperada");
    const maximo = Math.max(...analise.frequencias, analise.esperado_por_celula, 1);
    const tamanho = Math.sqrt(analise.frequencias.length);
    analise.frequencias.forEach((frequencia, indice) => {
        const barra = document.createElement("span");
        barra.style.height = `${100 * frequencia / maximo}%`;
        barra.title = `${String.fromCharCode(65 + Math.floor(indice / tamanho))}${indice % tamanho + 1}: ${frequencia} medições`;
        grafico.appendChild(barra);
    });
    const esperado = document.createElement("div");
    esperado.className = "medicoes-esperado";
    esperado.style.bottom = `${100 * analise.esperado_por_celula / maximo}%`;
    grafico.appendChild(esperado);
    bloco.appendChild(grafico);
    nota.textContent = `${analise.base}. ${analise.nota}${analise.aproximacao_chi2_adequada ? "" : " Frequências esperadas baixas: aproximação χ² inadequada."}`;
    bloco.appendChild(nota);
    return bloco;
}

document.getElementById("tamanhoTabuleiro").addEventListener("change", () => atualizarCircuitoPartida());
document.getElementById("dificuldade").addEventListener("click", event => {
    const botao = event.currentTarget;
    botao.value = botao.value === "plus" ? "normal" : "plus";
    atualizarChipClassico();
});
document.getElementById("tamanhoTabuleiro").addEventListener("change", () => atualizarChipClassico());
atualizarCircuitoPartida();
lucide.createIcons();
