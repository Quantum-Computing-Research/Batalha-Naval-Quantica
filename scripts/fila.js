function atualizarFila(fila) {
    const lista = document.getElementById("esperaList");
    lista.replaceChildren();
    fila.forEach(nome => {
        const item = document.createElement("li");
        item.textContent = nome;
        lista.appendChild(item);
    });
}

async function entrarNaFila() {
    const nome = sessionStorage.getItem("nomeJogador");
    if (!nome) return;
    try {
        const data = await apiFetch("/fila/entrar", { method: "POST", body: { nome } });
        atualizarFila(data.fila_espera);
    } catch (err) {
        atualizarStatusBar(`Erro ao entrar na fila: ${err.message}`);
    }
}
