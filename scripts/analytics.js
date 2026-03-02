
const HARDWARE_FILES = {
    "iqm_garnet": "./cache/iqm_garnet.json",
    "quera_aquila": "./cache/quera_aquila.json",
    "rigetti_ankaa": "./cache/rigetti_ankaa.json",
    "ionq_aria2": "./cache/ionq_aria2.json",
    "ionq_forte1": "./cache/ionq_forte1.json"
};

let charts = {};

function $(id) { return document.getElementById(id); }

function fillHardwareSelect() {
    const sel = $("hardwareSelect");
    sel.innerHTML = "";
    Object.keys(HARDWARE_FILES).forEach(hw => {
        const opt = document.createElement("option");
        opt.value = hw;
        opt.textContent = hw;
        sel.appendChild(opt);
    });
    sel.value = "ionq_aria2" in HARDWARE_FILES ? "ionq_aria2" : Object.keys(HARDWARE_FILES)[0];
}

async function loadHardware(hw) {
    const url = HARDWARE_FILES[hw];
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Falha ao carregar ${url} (HTTP ${res.status})`);
    return res.json();
}

function takeShots(bitstrings, n) {
    if (!Array.isArray(bitstrings)) return [];
    if (n <= 0) return bitstrings;
    return bitstrings.slice(0, Math.min(n, bitstrings.length));
}

function bitFreqPerQubit(bitstrings, nQ) {
    const freq = new Array(nQ).fill(0);
    const N = bitstrings.length || 1;
    for (const s of bitstrings) {
        for (let i = 0; i < nQ; i++) {
            if (s[i] === "1") freq[i] += 1;
        }
    }
    return freq.map(x => x / N);
}

function hammingWeights(bitstrings) {
    return bitstrings.map(s => [...s].reduce((acc, ch) => acc + (ch === "1"), 0));
}

function histogram(values, maxVal) {
    const bins = new Array(maxVal + 1).fill(0);
    for (const v of values) {
        if (v >= 0 && v <= maxVal) bins[v] += 1;
    }
    return bins;
}

function entropyBinary(p) {
    // p in [0,1], entropy in bits
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function entropyPerQubit(freq) {
    return freq.map(p => entropyBinary(p));
}

function autocorrLag1toK(bitstrings, maxLag = 20) {
    // converte cada shot em inteiro (0..2^n-1) e mede correlação simples
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

    // 2) Bit frequency per qubit
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
    const avgFreq = freq.reduce((a, b) => a + b, 0) / freq.length;
    const avgEnt = ent.reduce((a, b) => a + b, 0) / ent.length;

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

async function reload() {
    const hw = $("hardwareSelect").value;
    const desiredShots = parseInt($("shotsInput").value || "200", 10);

    const data = await loadHardware(hw);
    const nQ = data.n_qubits ?? (data.bitstrings?.[0]?.length ?? 0);
    const shots = Math.min(desiredShots, data.bitstrings?.length ?? 0);
    const bitstrings = takeShots(data.bitstrings || [], shots);

    renderCharts({ hw, nQ, shots, bitstrings });
}

function wire() {
    $("backBtn").addEventListener("click", () => window.location.href = "./index.html");
    $("reloadBtn").addEventListener("click", () => reload().catch(e => alert(e.message)));
    $("hardwareSelect").addEventListener("change", () => reload().catch(e => alert(e.message)));
}

(function init() {
    fillHardwareSelect();
    wire();
    reload().catch(e => alert(e.message));
})();

function setResumo(msg) {
    const el = document.getElementById("resumo");
    if (el) el.textContent = msg;
    console.log("[analytics]", msg);
}

function qs(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento #${id} não existe (canvas missing?)`);
    return el;
}

async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    // se vier HTML (ex: index.html), isso acusa cedo
    if (text.trim().startsWith("<")) {
        throw new Error(`Resposta não é JSON (parece HTML). URL: ${url}`);
    }
    const data = JSON.parse(text);
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
}

function ensureChart() {
    if (typeof Chart === "undefined") {
        throw new Error("Chart.js não carregou (Chart is undefined).");
    }
}

function renderPlaceholder() {
    // opcional: desenhar algo simples ou só atualizar resumo
    setResumo("Sem dados ainda. Verifique o endpoint /cache ou /analytics/data.");
}

async function loadAndRender() {
    ensureChart();

    // exemplo: endpoint do handler que você quer criar:
    // GET `${URL_BASE}/analytics/cache?hardware=ionq_aria2&shots=200`
    // por enquanto use um mock local, se existir:
    const hardware = document.getElementById("hardwareSelect")?.value || "ionq_aria2";
    const shots = parseInt(document.getElementById("shotsSelect")?.value || "200", 10);

    setResumo(`Carregando dados: hardware=${hardware}, shots=${shots}...`);

    // ⚠️ ajuste aqui pro seu endpoint real
    const url = `${URL_BASE}/analytics/cache?hardware=${encodeURIComponent(hardware)}&shots=${shots}`;
    const payload = await fetchJson(url);

    // payload.bitstrings = ["0101...","1110...",...]
    const bitstrings = payload.bitstrings || [];
    if (!bitstrings.length) {
        setResumo(`Sem bitstrings para ${hardware}. (backend offline ou cache vazio)`);
        renderPlaceholder();
        return;
    }

    setResumo(`OK: ${bitstrings.length} bitstrings carregadas. Renderizando...`);

    // >>> aqui você chama suas funções de análise e plota:
    renderAllCharts(bitstrings);
}

document.addEventListener("DOMContentLoaded", () => {
    // botão recarregar
    const btn = document.getElementById("btnRecarregar");
    if (btn) btn.addEventListener("click", () => loadAndRender().catch(e => setResumo("ERRO: " + e.message)));

    // load inicial
    loadAndRender().catch(e => setResumo("ERRO: " + e.message));
});