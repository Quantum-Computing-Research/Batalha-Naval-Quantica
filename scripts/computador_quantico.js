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
    const composicao = document.createElement("div");
    composicao.className = "circuito-diagrama chip-diagrama";
    const figuraChip = document.createElement("figure");
    figuraChip.className = "chip-hardware";
    const imagemChip = document.createElement("img");
    imagemChip.src = "assets/img/chip-classico.svg";
    imagemChip.alt = "Microprocessador clássico quadrado com terminais metálicos";
    imagemChip.width = 120;
    imagemChip.height = 100;
    figuraChip.appendChild(imagemChip);
    const diagrama = document.createElement("div");
    diagrama.className = "chip-rede";
    const coord = estadoChipClassico.coordenada;
    const eixo = bits / 2;
    const sequencia = coord ? [(coord.charCodeAt(0) - 65).toString(2).padStart(eixo, "0"), (Number(coord.slice(1)) - 1).toString(2).padStart(eixo, "0")].join("") : null;
    const altura = bits * 32;
    diagrama.style.height = `${altura}px`;
    const fios = [];
    const portas = [];
    for (let camada = 0; camada < 3; camada++) {
        const esquerda = 30 + camada * 76;
        for (let indice = 0; indice < bits; indice++) {
            const centro = indice * 32 + 16;
            const origem = ((indice + camada + 1) % bits) * 32 + 16;
            const entrada = camada === 0 ? 0 : esquerda - 40;
            const dobra = esquerda - 16 - (indice % 3) * 4;
            fios.push(`<path d="M${entrada} ${centro}H${esquerda}M${entrada} ${origem}H${dobra}V${centro + 5}H${esquerda}"/>`);
            portas.push(`<path d="M${esquerda} ${centro - 9}h15a9 9 0 0 1 0 18h-15z" fill="#d5eafa"/><circle cx="${esquerda + 27}" cy="${centro}" r="3" fill="#fff"/>`);
            if (camada === 2) fios.push(`<path d="M${esquerda + 30} ${centro}H240"/>`);
        }
    }
    const rede = document.createElement("img");
    rede.className = "chip-rede-imagem";
    rede.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 ${altura}" fill="none" stroke="#516b78" stroke-width="1.3">${fios.join("")}${portas.join("")}</svg>`)}`;
    rede.alt = `Circuito clássico ilustrativo com portas NAND interligadas e ${bits} saídas`;
    rede.width = 240;
    rede.height = altura;
    const saidas = document.createElement("div");
    saidas.className = "chip-rede-saidas";
    for (let indice = 0; indice < bits; indice++) {
        const valor = document.createElement("span");
        valor.className = "chip-bit-saida";
        valor.setAttribute("aria-label", `Bit de saída b${indice}`);
        valor.textContent = executando && sequencia ? sequencia[indice] : "—";
        saidas.appendChild(valor);
    }
    diagrama.append(rede, saidas);
    composicao.append(figuraChip, diagrama);
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
    const diagrama = document.createElement("div");
    diagrama.className = "circuito-diagrama";
    if (!circuito) return diagrama;
    const bits = circuito.qubits_por_eixo;
    const medicao = coordenada ? [coordenada[0].charCodeAt(0) - 65, Number(coordenada.slice(1)) - 1].map(valor => valor.toString(2).padStart(bits, "0")) : null;
    const informacoes = document.createElement("div");
    informacoes.className = "circuito-informacoes";
    const grupos = document.createElement("div");
    grupos.className = "circuito-grupos";
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
        porta.title = "Hadamard: superposição uniforme de 0 e 1";
        const medir = document.createElement("span");
        medir.className = "circuito-porta circuito-medicao";
        const visor = lucide.createElement(lucide.icons.Gauge);
        visor.setAttribute("aria-hidden", "true");
        medir.appendChild(visor);
        medir.setAttribute("role", "img");
        medir.setAttribute("aria-label", "Medição");
        medir.title = "Medição na base computacional";
        fio.append(porta, medir);
        const valor = document.createElement("span");
        valor.className = "circuito-bit";
        valor.textContent = sequencia ? sequencia[indice] : "—";
        linha.append(rotulo, fio, valor);
        grupos.appendChild(linha);
    }
    diagrama.appendChild(grupos);
    return diagrama;
}

function atualizarCircuitoPartida(circuito, coordenada = null, backend = null) {
    circuitoAtual = circuito || modeloCircuito(Number(document.getElementById("tamanhoTabuleiro").value));
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
        const legenda = document.createElement('figcaption');
        legenda.textContent = card.querySelector('h3').textContent;
        figura.append(imagem, legenda);
        composicao.appendChild(figura);
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
document.getElementById("modoSimulador").addEventListener("change", () => atualizarCircuitoPartida(modeloCircuito(Number(document.getElementById("tamanhoTabuleiro").value), document.getElementById("modoSimulador").checked ? "simulador" : "cache")));
atualizarCircuitoPartida();
lucide.createIcons();
