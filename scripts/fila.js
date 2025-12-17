function atualizarFila(fila) {
    const lista = document.getElementById("esperaList");
    lista.innerHTML = "";
    fila.forEach(nome => {
        const li = document.createElement("li");
        li.textContent = nome;
        lista.appendChild(li);
    });
}

function entrarNaFila() {
    const nome = document.getElementById('playerName').value.trim();
    if (!nome) return alert("Nome inválido para entrar na fila.");

    logBloco("🕓 Entrando na fila de espera com nome:", nome);

    fetch(`${URL_BASE}/fila/entrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome })
    })
        .then(res => res.json())
        .then(data => atualizarFila(data.fila_espera));
}