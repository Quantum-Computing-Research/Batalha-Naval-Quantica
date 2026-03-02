// ./scripts/analytics.js
// Fonte de verdade: API Gateway (Lambda)
// Rotas:
//   GET  /cache
//   GET  /cache/{hardware}

const URL_BASE = (() => {
    // 1) Se você quiser fixar via window.__API_BASE__ no HTML, ele usa.
    if (window.__API_BASE__) return window.__API_BASE__.replace(/\/$/, "");

    // 2) Caso contrário, tente ler do localStorage (se você salvar no jogo)
    const saved = localStorage.getItem("qb_api_base");
    if (saved) return saved.replace(/\/$/, "");

    // 3) Fallback: coloque seu endpoint aqui (com /prod se existir stage)
    // EXEMPLO:
    // return "https://5fd53e167e.execute-api.us-east-2.amazonaws.com/prod";
    return "";
})();

let charts = {};

function $(id) { return document.getElementById(id); }

function ensureChart() {
    if (typeof Chart === "undefined") {
        throw new Error("Chart.js não carregou (Chart is undefined). Verifique o <script> CDN.");
    }
}

async function apiFetch(path) {
    if (!URL_BASE) {
        throw new Error(
            "URL_BASE não configurada. Defina window.__API_BASE__ no HTML ou qb_api_base no localStorage."
        );
    }

    const url = `${URL_BASE}${path}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    // Se vier HTML (ex: 403/404 com página), explode cedo
    if (text.trim().startsWith("<")) {
        throw new Error(`Resposta não é JSON (parece HTML). URL: ${url}`);
    }

    let data = {};
    try { data = JSON.parse(text); } catch { data = {}; }

    if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status} em ${url}`);
    }
    return data;
}

async function loadHardwareList() {
    // GET /cache
    // Esperado: { hardwares: [...] } (mas aceito { items: [...] } etc)
    const data = await apiFetch("/cache");

    const hardwares =
        data.hardwares ||
        data.items ||
        data.backends ||
        [];

    if (!Array.isArray(hardwares) || hardwares.length === 0) {
        throw new Error("Endpoint /cache não retornou lista de hardwares.");
    }

    return hardwares;
}

async function loadHardware(hw) {
    // GET /cache/{hardware}
    // Esperado: { bitstrings: [...], n_qubits?: number }
    const data = await apiFetch(`/cache/${encodeURIComponent(hw)}`);

    const bitstrings =
        data.bitstrings ||
        data.data || // se você devolver direto como "data"
        [];

    if (!Array.isArray(bitstrings) || bitstrings.length === 0) {
        throw new Error(`Sem bitstrings para ${hw} (cache vazio ou backend offline).`);
    }

    const nQ =
        data.n_qubits ??
        data.nQ ??
        (bitstrings[0]?.length ?? 0);

    return { hw, nQ, bitstrings };
}

function takeShots(bitstrings, n) {
    if (!Array.isArray(bitstrings)) return [];
    if (!Number.isFinite(n) || n <= 0) return bitstrings;
    return bitstrings.slice(0, Math.min(n, bitstrings.length));
}

function bitFreqPerQubit(bitstrings, nQ) {
    const freq = new Array(nQ).fill(0);
    const N = bitstrings.length || 1;

    for (const s of bitstrings) {
        // Se vier bitstring maior/menor, corta/ignora fora do range
        for (let i = 0; i < nQ; i++) {
            if (s[i] === "1") freq[i] += 1;
        }
    }
    return freq.map(x => x / N);
}

function hammingWeights(bitstrings) {
    return bitstrings.map(s => {
        let w = 0;
        for (let i = 0; i < s.length; i++) if (s[i] === "1") w++;
        return w;
    });
}

function histogram(values, maxVal) {
    const bins = new Array(maxVal + 1).fill(0);
    for (const v of values) {
        if (v >= 0 && v <= maxVal) bins[v] += 1;
    }
    return bins;
}

function entropyBinary(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function entropyPerQubit(freq) {
    return freq.map(p => entropyBinary(p));
}

function autocorrLag1toK(bitstrings, maxLag = 20) {
    // Converte cada shot em inteiro e mede autocorr normalizada
    const xs = bitstrings.map(s => parseInt(s, 2));
    const N = xs.length;

    const mean = xs.reduce((a, b) => a + b, 0) / (N || 1);
    const varx = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (N || 1);

    const out = [];
    for (let lag = 1; lag <= maxLag; lag++) {
        if (N - lag <= 1 || varx === 0) { out.push(0); continue; }

        let cov = 0;
        for (let i = 0; i < N - lag; i++) {
            cov += (xs[i] - mean) * (xs[i + lag] - mean);
        }
        cov /= (N - lag);
        out.push(cov / varx);
    }
    return out;
}

function destroyCharts() {
    Object.values(charts).forEach(ch => ch?.destroy?.());
    charts = {};
}

function renderCharts({ hw, nQ, shots, bitstrings }) {
    destroyCharts();

    const weights = hammingWeights(bitstrings);
    const hist = histogram(weights, nQ);

    const freq = bitFreqPerQubit(bitstrings, nQ);
    const ent = entropyPerQubit(freq);
    const ac = autocorrLag1toK(bitstrings, 20);

    // 1) Hamming histogram
    charts.hamming = new Chart($("chartHamming"), {
        type: "bar",
        data: {
            labels: hist.map((_, i) => String(i)),
            datasets: [{ label: "contagem", data: hist }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: "nº de 1s na bitstring" } },
                y: { title: { display: true, text: "contagem" } }
            }
        }
    });

    // 2) Bit frequency
    charts.freq = new Chart($("chartBitFreq"), {
        type: "line",
        data: {
            labels: freq.map((_, i) => String(i)),
            datasets: [{ label: "P(bit=1)", data: freq, tension: 0.15 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 1 } }
        }
    });

    // 3) Autocorrelation
    charts.ac = new Chart($("chartAutoCorr"), {
        type: "line",
        data: {
            labels: ac.map((_, i) => String(i + 1)),
            datasets: [{ label: "autocorr", data: ac, tension: 0.15 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: -1, max: 1 } }
        }
    });

    // 4) Entropy
    charts.ent = new Chart($("chartEntropy"), {
        type: "line",
        data: {
            labels: ent.map((_, i) => String(i)),
            datasets: [{ label: "H(bit)", data: ent, tension: 0.15 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 1 } }
        }
    });

    // Summary
    const avgFreq = freq.reduce((a, b) => a + b, 0) / (freq.length || 1);
    const avgEnt = ent.reduce((a, b) => a + b, 0) / (ent.length || 1);

    $("summary").textContent =
        `hardware: ${hw}
n_qubits: ${nQ}
shots usados: ${shots}

média P(bit=1): ${avgFreq.toFixed(4)}
média entropia: ${avgEnt.toFixed(4)} bits

nota:
- ideal: P(bit=1) ~ 0.5, entropia ~ 1 por qubit
- autocorr ~ 0 (lags pequenos)`;
}

async function fillHardwareSelect() {
    const sel = $("hardwareSelect");
    sel.innerHTML = "";

    const hardwares = await loadHardwareList();

    hardwares.forEach(hw => {
        const opt = document.createElement("option");
        opt.value = hw;
        opt.textContent = hw;
        sel.appendChild(opt);
    });

    sel.value = hardwares.includes("ionq_aria2") ? "ionq_aria2" : hardwares[0];
}

async function reload() {
    ensureChart();

    const hw = $("hardwareSelect").value;
    const desiredShots = parseInt($("shotsInput").value || "200", 10);

    const data = await loadHardware(hw);

    const shots = Math.min(desiredShots, data.bitstrings.length);
    const bitstrings = takeShots(data.bitstrings, shots);

    renderCharts({ hw: data.hw, nQ: data.nQ, shots, bitstrings });
}

function wire() {
    $("backBtn").addEventListener("click", () => window.location.href = "./index.html");
    $("reloadBtn").addEventListener("click", () => reload().catch(e => alert(e.message)));
    $("hardwareSelect").addEventListener("change", () => reload().catch(e => alert(e.message)));
}

(async function init() {
    try {
        await fillHardwareSelect();
        wire();
        await reload();
    } catch (e) {
        alert(e.message);
    }
})();