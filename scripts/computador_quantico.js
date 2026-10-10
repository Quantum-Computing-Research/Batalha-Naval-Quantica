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
    const titulo = document.createElement("h3");
    titulo.textContent = `Circuito da partida · ${circuito.qubits_total} qubits`;
    const origem = document.createElement("p");
    origem.className = "circuito-origem";
    origem.textContent = `${circuito.origem} · P(célula) ideal = ${circuito.probabilidade_celula}`;
    const informacoes = document.createElement("div");
    informacoes.className = "circuito-informacoes";
    informacoes.append(titulo, origem);
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
    const resultado = document.createElement("p");
    resultado.className = "circuito-leitura";
    resultado.textContent = medicao ? `Ataque selecionado: ${medicao.join(" | ")} → ${coordenada}` : "|0⟩ → H → medição · Linha | Coluna";
    informacoes.appendChild(resultado);
    const resumo = document.createElement("dl");
    resumo.className = "circuito-numeros";
    for (const [label, valor] of [["Qubits", circuito.qubits_total], ["Estados", 2 ** circuito.qubits_total], ["P(célula)", circuito.probabilidade_celula]]) {
        const item = document.createElement("div");
        const nome = document.createElement("dt");
        nome.textContent = label;
        const numero = document.createElement("dd");
        numero.textContent = valor;
        item.append(numero, nome);
        resumo.appendChild(item);
    }
    informacoes.appendChild(resumo);
    diagrama.append(grupos, informacoes);
    return diagrama;
}

function atualizarCircuitoPartida(circuito, coordenada = null) {
    circuitoAtual = circuito || modeloCircuito(Number(document.getElementById("tamanhoTabuleiro").value));
    document.getElementById("circuitoPartida").replaceChildren(criarDiagramaCircuito(circuitoAtual, coordenada));
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
document.getElementById("modoSimulador").addEventListener("change", () => atualizarCircuitoPartida(modeloCircuito(Number(document.getElementById("tamanhoTabuleiro").value), document.getElementById("modoSimulador").checked ? "simulador" : "cache")));
atualizarCircuitoPartida();
lucide.createIcons();
