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
    const qubits = analysis.frequencia_bit_1_por_qubit.length;
    const outcomeCount = boardSize * boardSize;

    charts.hamming = new Chart($("chartHamming"), {
        type: "bar",
        data: {
            labels: analysis.hamming.map((_, index) => String(index)),
            datasets: [{ label: "Ataques observados", data: analysis.hamming, backgroundColor: accent, borderRadius: 2, maxBarThickness: 36 }],
        },
        options: { ...chartOptions(), scales: { ...chartOptions().scales, x: { ...chartOptions().scales.x, title: { display: true, text: "Peso de Hamming (número de bits 1)", color: "#64777b" } }, y: { ...chartOptions().scales.y, title: { display: true, text: "Contagem", color: "#64777b" } } } },
    });

    charts.bits = new Chart($("chartBits"), {
        type: "bar",
        data: { labels: Array.from({ length: qubits }, (_, index) => `q${index}`), datasets: [{ label: "Frequência observada", data: analysis.frequencia_bit_1_por_qubit, backgroundColor: accent, borderRadius: 2, maxBarThickness: 32 }] },
        options: chartOptions({ min: 0, max: 1, percent: true }),
    });

    charts.entropy = new Chart($("chartEntropy"), {
        type: "bar",
        data: { labels: Array.from({ length: qubits }, (_, index) => `q${index}`), datasets: [{ label: "Entropia de Shannon", data: analysis.entropia_por_qubit, backgroundColor: "#3286ab", borderRadius: 2, maxBarThickness: 32 }] },
        options: chartOptions({ min: 0, max: 1 }),
    });

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

    $("sampleCount").textContent = analysis.amostras.toLocaleString("pt-BR");
    $("entropyValue").textContent = `${analysis.entropia_bits.toFixed(2)} bits`;
    $("minEntropyValue").textContent = analysis.min_entropia_empirica_bits == null ? "—" : `${analysis.min_entropia_empirica_bits.toFixed(2)} bits`;
    $("analysisNote").textContent = `${analysis.celulas_observadas} de ${outcomeCount} casas observadas · ${analysis.repeticoes} repetidas · ${classicalExcluded} clássicas excluídas`;
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
    $("selectionMeta").textContent = `${data.partidas_total} partidas · tabuleiro ${size} × ${size} · ${data.qubits_total} qubits`;
    $("matchCount").textContent = `${data.partidas_analisadas} / ${data.partidas_total}`;
    $("xebValue").textContent = data.xeb?.disponivel ? data.xeb.valor.toFixed(3) : "Não calculável";
    $("xebReason").textContent = data.xeb?.motivo || "";
    $("tqcValue").textContent = data.tqc?.disponivel ? `${data.tqc.segundos.toFixed(3)} s` : "Não disponível";
    $("tqcReason").textContent = data.tqc?.motivo || "";
    $("certifiedEntropyValue").textContent = data.entropia_certificada?.disponivel ? `${data.entropia_certificada.bits} bits` : "Não certificada";
    $("certifiedEntropyReason").textContent = data.entropia_certificada?.motivo || "";
    $("excludedCount").textContent = `${data.ataques_classicos_excluidos} ataques clássicos fora da amostra`;
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
            option.textContent = hardware.nome.replaceAll("_", " ");
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