/********************************************************************
 * Quantum Battleship – Frontend JS (versão completa refatorada)
 * Objetivos:
 *  - Sessão persistente (game_id) via localStorage
 *  - apiFetch robusto (JSON/sem JSON, 204, erros, timeout)
 *  - Iniciar jogo: valida backend offline, salva game_id, atualiza UI
 *  - Encerrar jogo: limpa game_id + reseta UI
 *  - Atacar / Ataque quântico: atualiza placar + UI, encerra quando finaliza
 *
 * Dependências externas (já existentes no seu projeto):
 *  - URL_BASE (string)
 *  - desenharNavios(tabuleiro)
 *  - renderizarTabuleiro(container, tamanho, boardId)
 *  - desenharAtaqueJogador(x, y, acertou)
 *  - desenharAtaqueQuantico(x, y, acertou)
 *  - processarRespostaAtaqueJogador(data)
 *  - atualizarRanking(ranking)
 *  - atualizarFila(fila)
 *  - desenharTabuleiroAdversario(tabuleiro_quantico) [opcional]
 *  - mostrarAlertaFinal(msg)
 ********************************************************************/

/* =========================
   Estado local do front
========================= */

let placar = {
    jogador: 0,
    computador: 0,
};

// Se você quiser trocar o nome da chave, só muda aqui.
const STORAGE_GAME_ID_KEY = "qb_game_id";

/* =========================
   Sessão (game_id)
========================= */

function getGameId() {
    return localStorage.getItem(STORAGE_GAME_ID_KEY);
}

function setGameId(id) {
    if (!id) return;
    localStorage.setItem(STORAGE_GAME_ID_KEY, id);
}

function clearGameId() {
    localStorage.removeItem(STORAGE_GAME_ID_KEY);
}

/* =========================
   Helpers de UI/UX
========================= */

function atualizarStatusBar(texto) {
    const barra = document.getElementById("statusBar");
    if (!barra) return;

    barra.innerText = `${texto}
🎯 Placar → Jogador: ${placar.jogador}  |  Computador: ${placar.computador}`;
}

function atualizarVez(vezDoJogador) {
    const vezDiv = document.getElementById("vez-indicador");
    if (!vezDiv) return;

    if (vezDoJogador) {
        vezDiv.innerHTML = "🟢 Sua vez de atacar!";
        vezDiv.className = "vez-status vez-jogador";
    } else {
        vezDiv.innerHTML = "⏳ Esperando ataque quântico...";
        vezDiv.className = "vez-status vez-computador";
    }
}

function limparStatusBarEVezJogador() {
    const barra = document.getElementById("statusBar");
    if (barra) barra.innerText = "";

    const vezDiv = document.getElementById("vez-indicador");
    if (vezDiv) {
        vezDiv.innerHTML = "⏳";
        vezDiv.className = "vez-status";
    }
}

function setButtonsState({ startEnabled, waitEnabled, endEnabled }) {
    const startBtn = document.getElementById("startButton");
    const waitBtn = document.getElementById("waitButton");
    const endBtn = document.getElementById("endButton");

    if (startBtn) startBtn.disabled = !startEnabled;
    if (waitBtn) waitBtn.disabled = !waitEnabled;
    if (endBtn) endBtn.disabled = !endEnabled;
}

function marcarBackendOfflineSeSelecionado() {
    const card = document.querySelector(".card.selecionado");
    if (!card) return;
    card.classList.add("offline");
    card.classList.remove("selecionado"); // opcional
}

function getBackendSelecionado() {
    const backendCard = document.querySelector(".card.selecionado");
    // tenta em ordem: data-backend, id, default
    return backendCard?.dataset?.backend || backendCard?.id || "default";
}

function limparInputJogada() {
    const input = document.getElementById("playerMove");
    if (!input) return;
    input.value = "";
    input.focus();
    input.select();
}

/* =========================
   Fetch robusto (API Gateway)
========================= */

/**
 * apiFetch
 * - inclui x-game-id automaticamente se existir
 * - trata 204 (no content)
 * - tenta parsear JSON, mas não explode se vier vazio
 * - timeout via AbortController (padrão 15s)
 */
async function apiFetch(path, { method = "GET", body = null, timeoutMs = 15000 } = {}) {
    const gameId = getGameId();

    const headers = {
        "Content-Type": "application/json",
    };
    if (gameId) headers["x-game-id"] = gameId;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(`${URL_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") throw new Error("Timeout falando com o servidor.");
        throw err;
    } finally {
        clearTimeout(timer);
    }

    // 204/205 sem body
    if (res.status === 204 || res.status === 205) return {};

    const raw = await res.text().catch(() => "");
    const data = raw ? safeJsonParse(raw) : {};

    if (!res.ok) {
        // tenta retornar mensagem de erro mais amigável
        const msg =
            (data && (data.error || data.message || data.detail)) ||
            `HTTP ${res.status}`;
        throw new Error(msg);
    }

    return data;
}

function safeJsonParse(txt) {
    try {
        return JSON.parse(txt);
    } catch {
        return {};
    }
}

/* =========================
   Fluxo do jogo
========================= */

async function iniciarJogo(nome) {
    const numNavios = parseInt(document.getElementById("numNavios")?.value, 10);
    const tamanhoTabuleiro = parseInt(document.getElementById("tamanhoTabuleiro")?.value, 10);

    const backend = getBackendSelecionado();

    // travar botões enquanto inicia
    setButtonsState({ startEnabled: false, waitEnabled: false, endEnabled: false });
    atualizarStatusBar(`⏳ Iniciando partida… (${backend})`);

    let data;
    try {
        data = await apiFetch("/iniciar_jogo", {
            method: "POST",
            body: { nome, backend, num_navios: numNavios, tamanho_tabuleiro: tamanhoTabuleiro },
        });
    } catch (err) {
        // reabilita start se falhar
        setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
        atualizarStatusBar(`❌ Erro ao iniciar: ${err.message}`);
        alert(`Erro ao iniciar: ${err.message}`);
        return;
    }

    // Backend offline: não inicia jogo, não salva game_id
    if (data.backend_offline) {
        marcarBackendOfflineSeSelecionado();

        atualizarStatusBar(
            `⚠️ Backend "${data.backend}" OFFLINE (sem cache) para tabuleiro ${data.tamanho_tabuleiro}.`
        );
        alert(`Backend "${data.backend}" está OFFLINE para tabuleiro ${data.tamanho_tabuleiro}.`);

        setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
        return;
    }

    // começou: salva game_id
    setGameId(data.game_id);

    // UI states
    setButtonsState({ startEnabled: false, waitEnabled: true, endEnabled: true });
    atualizarStatusBar(`Jogo em andamento. Jogador: ${nome}`);
    atualizarVez(true);

    // desenha navios e outros painéis
    if (data.tabuleiro_jogador) desenharNavios(data.tabuleiro_jogador);
    if (data.ranking) atualizarRanking(data.ranking);
    if (data.fila_espera) atualizarFila(data.fila_espera);

    // foco no input de jogada
    limparInputJogada();
}

/**
 * Encerrar jogo:
 * - chama backend
 * - limpa game_id
 * - reseta UI e placar
 */
async function encerrarJogo({ silentConfirm = false } = {}) {
    if (!silentConfirm) {
        const confirmacao = confirm(
            "Tem certeza de que deseja encerrar a partida? Todos os dados do experimento serão perdidos!"
        );
        if (!confirmacao) return;
    }

    try {
        await apiFetch("/encerrar_jogo", { method: "POST", body: {} });
    } catch (err) {
        // mesmo se falhar, limpamos localmente para não ficar preso num game_id ruim
        console.warn("Erro ao encerrar no backend:", err);
    }

    clearGameId();

    // UI reset
    setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
    atualizarStatusBar("");
    limparStatusBarEVezJogador();

    const nomeInput = document.getElementById("nomeJogadorInput");
    if (nomeInput) nomeInput.value = "";

    // re-render tabuleiros vazios
    const tamanho = parseInt(document.getElementById("tamanhoTabuleiro")?.value, 10);
    const containerJogador = document.querySelector(".tabuleiro-jogador");
    const containerComputador = document.querySelector(".tabuleiro-computador");

    if (containerJogador && Number.isFinite(tamanho)) {
        renderizarTabuleiro(containerJogador, tamanho, "playerBoard");
    }
    if (containerComputador && Number.isFinite(tamanho)) {
        renderizarTabuleiro(containerComputador, tamanho, "computerBoard");
    }

    // reset placar
    placar.jogador = 0;
    placar.computador = 0;
}

/* =========================
   Ações de turno
========================= */

async function atacar() {
    const coordenada = document.getElementById("playerMove")?.value?.trim();
    if (!coordenada) return alert("Digite uma coordenada válida!");

    // se não tem game id, não dá pra atacar
    const gameId = getGameId();
    if (!gameId) {
        alert("Sessão do jogo não encontrada. Inicie uma nova partida.");
        return;
    }

    let data;
    try {
        data = await apiFetch("/atacar", { method: "POST", body: { coordenada } });
    } catch (err) {
        atualizarStatusBar(`❌ Erro no ataque: ${err.message}`);
        alert(`Erro no ataque: ${err.message}`);
        return;
    }

    // desenha ataque do jogador
    const letra = coordenada[0].toUpperCase();
    const numero = parseInt(coordenada.slice(1), 10);
    const x = numero - 1;
    const y = letra.charCodeAt(0) - 65;

    desenharAtaqueJogador(x, y, data.status === "acerto");

    if (data.status === "acerto") placar.jogador++;

    atualizarStatusBar(`Você atacou ${coordenada.toUpperCase()} → ${data.mensagem}`);
    processarRespostaAtaqueJogador(data);

    const finalizou = data.finalizado === true || data.finalizado === "true";
    if (finalizou) {
        mostrarAlertaFinal(data.mensagem);
        if (data.tabuleiro_quantico) desenharTabuleiroAdversario(data.tabuleiro_quantico);

        // encerra sem pedir confirmação (o jogo já acabou)
        await encerrarJogo({ silentConfirm: true });
        return;
    }

    limparInputJogada();
}

/**
 * Turno do computador:
 * - chama /ataque-quantico
 * - redesenha e atualiza vez
 * - se ainda for a vez do computador, agenda novo ataque
 */
async function ataqueComputador() {
    // se não tem game id, não roda
    const gameId = getGameId();
    if (!gameId) return;

    let data;
    try {
        data = await apiFetch("/ataque-quantico");
    } catch (err) {
        atualizarStatusBar(`❌ Erro no ataque quântico: ${err.message}`);
        alert(`Erro no ataque quântico: ${err.message}`);
        return;
    }

    const [linha, coluna] = data.jogada_quantica || [];
    const acertou = data.status === "acerto";

    // cuidado: seu desenho usa (coluna, linha)
    if (Number.isFinite(linha) && Number.isFinite(coluna)) {
        desenharAtaqueQuantico(coluna, linha, acertou);
    }

    atualizarStatusBar(data.mensagem || "Ataque quântico executado.");
    atualizarVez(!!data.vez_do_jogador);

    if (acertou) placar.computador++;

    if (data.finalizado === true) {
        if (data.tabuleiro_quantico) desenharTabuleiroAdversario(data.tabuleiro_quantico);

        requestAnimationFrame(() => {
            setTimeout(async () => {
                mostrarAlertaFinal(data.mensagem);
                await encerrarJogo({ silentConfirm: true });
            }, 3300);
        });
        return;
    }

    // se ainda não é a vez do jogador, o computador continua atacando
    if (!data.vez_do_jogador) {
        setTimeout(ataqueComputador, 600);
    }
}

/* =========================
   Modal de consentimento (mantido)
========================= */

document.getElementById("confirmarConsentimento")?.addEventListener("click", () => {
    const nome = document.getElementById("nomeJogadorInput")?.value?.trim();
    if (!nome) {
        alert("Digite seu nome para continuar.");
        return;
    }

    sessionStorage.setItem("nomeJogador", nome);

    const modal = document.getElementById("consentimentoModal");
    if (modal) modal.style.display = "none";

    iniciarJogo(nome);
});

document.getElementById("cancelarConsentimento")?.addEventListener("click", () => {
    const modal = document.getElementById("consentimentoModal");
    if (modal) modal.style.display = "none";
});

function cancelarJogo() {
    alert("Jogo encerrado. Obrigado pela visita!");
    const modal = document.getElementById("consentimentoModal");
    if (modal) modal.style.display = "none";
}

/* =========================
   (Opcional, mas MUITO útil)
   Recuperar sessão após refresh
   - Só reabilita botões de “encerrar / esperar”
   - Não tenta reconstruir tabuleiro automaticamente (você pode criar /estado depois)
========================= */

(function restoreSessionOnLoad() {
    const gameId = getGameId();
    if (!gameId) {
        // estado inicial
        setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
        return;
    }

    // existe game_id salvo → assume que tem jogo em andamento
    setButtonsState({ startEnabled: false, waitEnabled: true, endEnabled: true });
    atualizarStatusBar("🔁 Sessão recuperada (game_id local). Você pode continuar a partida.");
})();