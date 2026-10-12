const charts = {};

function $(id) {
    return document.getElementById(id);
}

async function apiFetch(path) {
    if (!URL_BASE) throw new Error("URL da API não configurada.");
    const response = await fetch(`${URL_BASE}${path}`, { cache: "no-store" });
    const body = await response.text();
    if (body.trim().startsWith("<")) throw new Error(`Resposta inválida da API (${response.status}).`);
    let data;
    try {
        data = JSON.parse(body);
    } catch {
        throw new Error("A API retornou dados inválidos.");
    }
    if (!response.ok) throw new Error(data.error || `Falha na API (${response.status}).`);
    return data;
}

function setStatus(message, state = "ready") {
    $("statusMessage").textContent = message;
    $("statusIndicator").dataset.state = state;
}

function destroyCharts() {
    Object.values(charts).forEach(chart => chart?.destroy());
    for (const key of Object.keys(charts)) delete charts[key];
}

function chartOptions({ min, max, percent = false } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
            legend: { labels: { color: "#64777b", usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
            tooltip: { backgroundColor: "#26383c", titleFont: { family: "Avenir Next, sans-serif" }, bodyFont: { family: "Avenir Next, sans-serif" } },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: "#64777b", maxRotation: 0, autoSkip: true }, border: { color: "#d7e1e1" } },
            y: { min, max, grid: { color: "#e8eeee" }, ticks: { color: "#64777b", callback: value => percent ? `${Math.round(value * 100)}%` : value }, border: { display: false } },
        },
    };
}

function renderCharts(analysis, boardSize, classicalExcluded) {
    destroyCharts();
    const accent = "#096e71";
    const orange = "#e87924";
    const conjunta = analysis.conjunta === true;
    const qubits = analysis.frequencia_bit_1_por_qubit?.length || 0;
    const outcomeCount = conjunta ? 256 : boardSize * boardSize;
    const hammingData = conjunta ? analysis.hamming_normalizado : analysis.hamming;
    const hammingLabels = conjunta
        ? hammingData.map((_, index) => `${(index * 12.5).toFixed(index % 2 ? 1 : 0)}%`)
        : hammingData.map((_, index) => String(index));

    $("hammingTitle").textContent = conjunta ? "Peso de Hamming normalizado" : "Distribuição de Hamming";
    $("hammingDescription").textContent = conjunta
        ? "Fração de bits 1 em relação à largura de cada tabuleiro"
        : "Número de bits 1 por coordenada quântica";
    $("bitsTitle").textContent = conjunta ? "Posição relativa observada" : "Frequência de bit 1";
    $("bitsDescription").textContent = conjunta
        ? "Linha e coluna normalizadas; esperado ponderado pelo tamanho"
        : "Marginal observada em cada qubit";
    $("entropyTitle").textContent = conjunta ? "Entropia relativa por tabuleiro" : "Entropia por qubit";
    $("entropyDescription").textContent = conjunta
        ? "Shannon observada / máximo possível para cada tamanho"
        : "Shannon empírica, em bits";
    $("cellsTitle").textContent = conjunta ? "Uniformidade por tabuleiro" : "Frequência por casa";
    $("cellsDescription").textContent = conjunta
        ? "χ² por grau de liberdade; referência descritiva = 1"
        : "Observado e esperado sob distribuição uniforme";

    charts.hamming = new Chart($("chartHamming"), {
        type: "bar",
        data: {
            labels: hammingLabels,
            datasets: [{ label: "Ataques observados", data: hammingData, backgroundColor: accent, borderRadius: 2, maxBarThickness: 36 }],
        },
        options: { ...chartOptions(), scales: { ...chartOptions().scales, x: { ...chartOptions().scales.x, title: { display: true, text: conjunta ? "Fração de bits 1" : "Peso de Hamming (número de bits 1)", color: "#64777b" } }, y: { ...chartOptions().scales.y, title: { display: true, text: "Contagem", color: "#64777b" } } } },
    });

    if (conjunta) {
        const count = analysis.amostras || 1;
        charts.bits = new Chart($("chartBits"), {
            type: "line",
            data: {
                labels: Array.from({ length: 16 }, (_, index) => `${Math.round(index * 100 / 16)}%`),
                datasets: [
                    { label: "Linha observada", data: analysis.frequencia_linha_normalizada.map(value => value / count), borderColor: accent, backgroundColor: accent, tension: 0.15 },
                    { label: "Coluna observada", data: analysis.frequencia_coluna_normalizada.map(value => value / count), borderColor: "#3286ab", backgroundColor: "#3286ab", tension: 0.15 },
                    { label: "Baseline ponderado", data: analysis.esperada_linha_normalizada.map(value => value / count), borderColor: orange, borderDash: [5, 4], pointRadius: 0, tension: 0 },
                ],
            },
            options: chartOptions({ min: 0, percent: true }),
        });
    } else {
        charts.bits = new Chart($("chartBits"), {
            type: "bar",
            data: { labels: Array.from({ length: qubits }, (_, index) => `q${index}`), datasets: [{ label: "Frequência observada", data: analysis.frequencia_bit_1_por_qubit, backgroundColor: accent, borderRadius: 2, maxBarThickness: 32 }] },
            options: chartOptions({ min: 0, max: 1, percent: true }),
        });
    }

    charts.entropy = new Chart($("chartEntropy"), conjunta ? {
        type: "bar",
        data: { labels: analysis.entropia_por_tabuleiro.map(item => `${item.tamanho_tabuleiro} × ${item.tamanho_tabuleiro}`), datasets: [{ label: "Entropia / máximo", data: analysis.entropia_por_tabuleiro.map(item => item.entropia_normalizada), backgroundColor: "#3286ab", borderRadius: 2, maxBarThickness: 48 }] },
        options: chartOptions({ min: 0, max: 1, percent: true }),
    } : {
        type: "bar",
        data: { labels: Array.from({ length: qubits }, (_, index) => `q${index}`), datasets: [{ label: "Entropia de Shannon", data: analysis.entropia_por_qubit, backgroundColor: "#3286ab", borderRadius: 2, maxBarThickness: 32 }] },
        options: chartOptions({ min: 0, max: 1 }),
    });

    if (conjunta) {
        charts.cells = new Chart($("chartCells"), {
            type: "bar",
            data: {
                labels: analysis.entropia_por_tabuleiro.map(item => `${item.tamanho_tabuleiro} × ${item.tamanho_tabuleiro}`),
                datasets: [
                    { type: "bar", label: "χ² / graus de liberdade", data: analysis.entropia_por_tabuleiro.map(item => item.chi2_por_grau_liberdade), backgroundColor: accent, borderRadius: 2, maxBarThickness: 48 },
                    { type: "line", label: "Referência descritiva", data: analysis.entropia_por_tabuleiro.map(() => 1), borderColor: orange, borderDash: [5, 4], pointRadius: 0, borderWidth: 2 },
                ],
            },
            options: chartOptions({ min: 0 }),
        });
    } else {
        const rows = boardSize;
        const rowCounts = Array.from({ length: rows }, (_, row) => analysis.frequencias.slice(row * rows, (row + 1) * rows).reduce((sum, value) => sum + value, 0));
        const esperadoPorLinha = analysis.amostras / rows;
        charts.cells = new Chart($("chartCells"), {
            type: "bar",
            data: {
                labels: Array.from({ length: rows }, (_, index) => String.fromCharCode(65 + index)),
                datasets: [
                    { type: "bar", label: "Ataques observados", data: rowCounts, backgroundColor: accent, borderRadius: 2, maxBarThickness: 44 },
                    { type: "line", label: "Esperado uniforme", data: Array(rows).fill(esperadoPorLinha), borderColor: orange, borderDash: [5, 4], pointRadius: 0, borderWidth: 2 },
                ],
            },
            options: { ...chartOptions(), scales: { ...chartOptions().scales, x: { ...chartOptions().scales.x, title: { display: true, text: "Linha do tabuleiro", color: "#64777b" } }, y: { ...chartOptions().scales.y, title: { display: true, text: "Contagem", color: "#64777b" } } } },
        });
    }

    $("sampleCount").textContent = analysis.amostras.toLocaleString("pt-BR");
    $("entropyLabel").textContent = conjunta ? "Entropia / baseline" : "Entropia empírica";
    $("entropyValue").textContent = conjunta
        ? `${(analysis.entropia_normalizada * 100).toFixed(1)}%`
        : `${analysis.entropia_bits.toFixed(2)} bits`;
    $("minEntropyLabel").textContent = conjunta ? "Min-entropia empírica · grade 16 × 16" : "Min-entropia empírica";
    $("minEntropyValue").textContent = analysis.min_entropia_empirica_bits == null ? "—" : `${analysis.min_entropia_empirica_bits.toFixed(2)} bits`;
    $("analysisNote").textContent = conjunta
        ? `Entropia relativa ao baseline ponderado por tamanho · ${classicalExcluded} clássicas excluídas`
        : `${analysis.celulas_observadas} de ${outcomeCount} casas observadas · ${analysis.repeticoes} repetidas · ${classicalExcluded} clássicas excluídas`;
}

function formatDate(value) {
    if (!value) return "Data indisponível";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function renderMatches(matches) {
    const list = $("matchesList");
    list.replaceChildren();
    if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Nenhuma partida arquivada para esta seleção.";
        list.appendChild(empty);
        return;
    }

    matches.forEach(match => {
        const item = document.createElement("details");
        item.className = "match-item";
        const summary = document.createElement("summary");
        const title = document.createElement("span");
        title.className = "match-title";
        title.textContent = `${match.jogador} · ${formatDate(match.data)}`;
        const count = document.createElement("span");
        count.className = "match-count";
        count.textContent = `${match.ataques_quanticos} ataques quânticos`;
        summary.append(title, count);
        item.appendChild(summary);

        const metrics = document.createElement("dl");
        metrics.className = "match-metrics";
        for (const [label, value] of [
            ["Partida", match.id || "—"],
            ["Hardware associado", match.hardware || "—"],
            ["Modo de geração", match.origem_jogadas === "simulador_cache_v0" ? "Mock QPU v0 · cache persistido" : match.modo === "simulador" ? "Simulador direto" : "Cache do hardware"],
            ["Resultado", match.vencedor || "—"],
            ["Acertos quânticos", `${match.acertos} / ${match.ataques_quanticos}`],
            ["Ataques clássicos excluídos", match.ataques_classicos],
            ["Pontuação", match.pontuacao],
            ["Incluída nos índices", match.incluida ? "Sim" : "Não · sem ataques quânticos"],
        ]) {
            const row = document.createElement("div");
            const term = document.createElement("dt");
            term.textContent = label;
            const definition = document.createElement("dd");
            definition.textContent = value;
            row.append(term, definition);
            metrics.appendChild(row);
        }
        item.appendChild(metrics);
        list.appendChild(item);
    });
}

function renderUnavailable() {
    destroyCharts();
    for (const id of ["sampleCount", "entropyValue", "minEntropyValue"]) $(id).textContent = "—";
    const conjunta = $("boardSelect").value === "todos";
    $("entropyLabel").textContent = conjunta ? "Entropia / baseline" : "Entropia empírica";
    $("minEntropyLabel").textContent = conjunta ? "Min-entropia empírica · grade 16 × 16" : "Min-entropia empírica";
    $("analysisNote").textContent = "Sem dados quânticos arquivados para esta seleção.";
}

async function loadHardwareList() {
    const data = await apiFetch("/analises");
    return Array.isArray(data.hardwares) ? data.hardwares : [];
}

async function reloadAnalysis() {
    if (typeof Chart === "undefined") throw new Error("Os gráficos não carregaram.");
    const hardware = $("hardwareSelect").value;
    const size = $("boardSelect").value;
    if (!hardware) {
        renderUnavailable();
        setStatus("Selecione um computador", "empty");
        return;
    }
    setStatus("Atualizando partidas", "loading");
    const query = new URLSearchParams({ hardware, tamanho_tabuleiro: size });
    const data = await apiFetch(`/analises?${query}`);
    const simuladas = data.partidas_modo_simulador || 0;
    const tabuleiroLabel = size === "todos" ? "todos os tamanhos" : `tabuleiro ${size} × ${size} · ${data.qubits_total} qubits`;
    $("selectionMeta").textContent = `${data.partidas_total} partidas · ${simuladas} testes simulados incluídos · ${tabuleiroLabel}`;
    $("matchCount").textContent = `${data.partidas_analisadas} / ${data.partidas_total}`;
    $("xebValue").textContent = data.xeb?.disponivel ? data.xeb.valor.toFixed(3) : "Não calculável";
    $("xebReason").textContent = data.xeb?.motivo || "";
    $("tqcValue").textContent = data.tqc?.disponivel ? `${data.tqc.segundos.toFixed(3)} s` : "Não disponível";
    $("tqcReason").textContent = data.tqc?.motivo || "";
    $("certifiedEntropyValue").textContent = data.entropia_certificada?.disponivel ? `${data.entropia_certificada.bits} bits` : "Não certificada";
    $("certifiedEntropyReason").textContent = data.entropia_certificada?.motivo || "";
    $("excludedCount").textContent = `${data.ataques_classicos_excluidos} ataques clássicos excluídos · ${simuladas} partidas simuladas de hardware incluídas`;
    renderMatches(data.partidas || []);

    if (!data.analise?.disponivel) {
        renderUnavailable();
        setStatus("Sem partidas para esta seleção", "empty");
        return;
    }
    renderCharts(data.analise, Number(size), data.ataques_classicos_excluidos);
    setStatus("Análise atualizada", "ready");
}

async function initialize() {
    lucide.createIcons();
    $("backBtn").addEventListener("click", () => window.location.href = "./index.html");
    $("reloadBtn").addEventListener("click", () => reloadAnalysis().catch(showError));
    $("hardwareSelect").addEventListener("change", () => reloadAnalysis().catch(showError));
    $("boardSelect").addEventListener("change", () => reloadAnalysis().catch(showError));

    try {
        const hardwares = await loadHardwareList();
        const select = $("hardwareSelect");
        select.replaceChildren();
        hardwares.forEach(hardware => {
            const option = document.createElement("option");
            option.value = hardware.id;
            const simuladas = hardware.partidas_modo_simulador || 0;
            const amostrasTeste = simuladas ? ` · ${simuladas} ${simuladas === 1 ? "teste" : "testes"}` : "";
            option.textContent = `${hardware.nome.replaceAll("_", " ")}${amostrasTeste}`;
            select.appendChild(option);
        });
        const firstWithGames = hardwares.find(hardware => hardware.partidas > 0);
        if (firstWithGames) select.value = firstWithGames.id;
        if (!hardwares.length) setStatus("Nenhum hardware listado", "empty");
        await reloadAnalysis();
    } catch (error) {
        showError(error);
    }
}

function showError(error) {
    setStatus(error.message || "Falha ao carregar a análise", "error");
}

initialize();