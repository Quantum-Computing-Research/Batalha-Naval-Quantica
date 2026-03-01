/********************************************************************
 * MELHORIA: boot da página
 * 1) Se existir game_id no localStorage -> tenta recuperar partida via /estado
 *    - se o jogo não existir/expirou -> limpa game_id e volta pro modo "novo jogo"
 * 2) Se NÃO existir game_id -> pede status dos backends via /backends/status
 *    - marca cards offline se backend sem cache pro tamanho do tabuleiro selecionado
 *
 * Requer no backend:
 *   GET /estado   (já existe no seu handler) -> retorna em_andamento, backend, jogador, etc
 *
 * NOVO no backend (precisa implementar):
 *   GET /backends/status?tamanho_tabuleiro=10
 *   resposta sugerida:
 *   {
 *     "tamanho_tabuleiro": 10,
 *     "backends": [
 *       {"backend":"ionq_aria","online":true,"moves_count":120},
 *       {"backend":"rigetti_ankaa","online":false,"moves_count":0}
 *     ]
 *   }
 ********************************************************************/

// ---------- helpers de UI p/ backends ----------
function getAllBackendCards() {
    return Array.from(document.querySelectorAll(".card[data-backend], .card[id]"));
}

function getCardBackendId(card) {
    return card?.dataset?.backend || card?.id || null;
}

function setCardOffline(card, offline) {
    if (!card) return;
    if (offline) card.classList.add("offline");
    else card.classList.remove("offline");
}

// Marca offline/online de acordo com payload do backend
function applyBackendStatusToCards(statusPayload) {
    const list = statusPayload?.backends || [];
    const map = new Map(list.map(b => [b.backend, !!b.online]));

    for (const card of getAllBackendCards()) {
        const bid = getCardBackendId(card);
        if (!bid) continue;

        // Se backend não veio no payload, não mexe (ou marca offline se você preferir)
        if (!map.has(bid)) continue;

        setCardOffline(card, !map.get(bid));
    }
}

// ---------- chamada p/ status de backends ----------
async function refreshBackendStatus() {
    const tamanho = parseInt(document.getElementById("tamanhoTabuleiro")?.value, 10) || 10;

    // se o usuário já escolheu tamanho, a gente usa isso pra saber se há cache compatível
    const data = await apiFetch(`/backends/status?tamanho_tabuleiro=${encodeURIComponent(tamanho)}`, {
        method: "GET",
    });

    applyBackendStatusToCards(data);
    return data;
}

// ---------- recuperar partida existente ----------
async function tryRecoverGameFromServer(gameId) {
    // /estado já usa o x-game-id que apiFetch injeta automaticamente
    const st = await apiFetch("/estado", { method: "GET" });

    // se não está em andamento, consideramos encerrado/expirado
    if (!st || st.em_andamento !== true) {
        throw new Error("Partida não está mais em andamento (expirada/encerrada).");
    }

    // Se quiser, você pode também:
    // - destacar no UI qual backend está em uso (st.backend)
    // - colocar o nome do jogador (st.jogador) em algum lugar
    atualizarStatusBar(`🔁 Partida recuperada (backend: ${st.backend || "?"})`);
    setButtonsState({ startEnabled: false, waitEnabled: true, endEnabled: true });

    // opcional: marcar backend atual como selecionado/ativo
    if (st.backend) {
        for (const card of getAllBackendCards()) {
            const bid = getCardBackendId(card);
            if (bid === st.backend) {
                card.classList.add("selecionado");
            } else {
                card.classList.remove("selecionado");
            }
        }
    }

    // Aqui você pode decidir o que fazer com placar:
    // - manter zerado
    // - tentar recuperar se você passar isso no /estado depois
    atualizarVez(true);

    return st;
}

// ---------- boot principal ----------
async function bootPage() {
    const gameId = getGameId();

    if (gameId) {
        // Tentativa de recuperar sessão real do servidor
        try {
            await tryRecoverGameFromServer(gameId);
            return; // recuperou, não precisa checar backend status agora
        } catch (err) {
            console.warn("Falha ao recuperar partida:", err);

            // limpa local e volta pro modo "novo jogo"
            clearGameId();
            setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
            limparStatusBarEVezJogador();
            atualizarStatusBar("⚠️ Sessão antiga encontrada, mas a partida não existe mais. Inicie uma nova.");
            // cai para checar status dos backends
        }
    }

    // Sem game_id: checa status dos backends e marca offline no UI
    try {
        setButtonsState({ startEnabled: true, waitEnabled: false, endEnabled: false });
        atualizarStatusBar("🔎 Checando disponibilidade dos backends…");
        const data = await refreshBackendStatus();

        // mensagem extra se todos estiverem offline
        const backs = data?.backends || [];
        const anyOnline = backs.some(b => b.online);
        if (!anyOnline && backs.length) {
            atualizarStatusBar("⚠️ Nenhum backend está ONLINE para esse tamanho de tabuleiro (sem cache).");
        } else {
            atualizarStatusBar("");
        }
    } catch (err) {
        console.warn("Falha ao buscar status de backends:", err);
        // Não bloqueia o jogo: só avisa
        atualizarStatusBar("⚠️ Não consegui checar status dos backends agora. Você ainda pode tentar iniciar.");
    }
}

// ---------- (recomendado) atualizar status ao mudar tamanho do tabuleiro ----------
function wireBackendStatusAutoRefresh() {
    const sel = document.getElementById("tamanhoTabuleiro");
    if (!sel) return;

    sel.addEventListener("change", async () => {
        // só faz isso quando não tem partida ativa
        if (getGameId()) return;
        try {
            await refreshBackendStatus();
        } catch (err) {
            console.warn("Falha ao atualizar status ao mudar tamanho:", err);
        }
    });
}

// Chame no final do seu JS (depois de apiFetch e helpers existirem)
(async function init() {
    wireBackendStatusAutoRefresh();
    await bootPage();
})();