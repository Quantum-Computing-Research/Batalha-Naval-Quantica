function mostrarAlertaFinal(mensagem) {
    const overlay = document.createElement("div");
    overlay.id = "alerta-overlay";

    const alerta = document.createElement("div");
    alerta.id = "alerta-container";

    const titulo = document.createElement("h2");
    titulo.textContent = "🏁 Fim de Jogo";
    alerta.appendChild(titulo);

    const texto = document.createElement("p");
    texto.textContent = mensagem;
    alerta.appendChild(texto);

    const botao = document.createElement("button");
    botao.textContent = "Encerrar Jogo";

    botao.onclick = () => {
        fetch(`${URL_BASE}/encerrar`, { method: "POST" }).then(() => {
            window.location.reload();
        });
    };

    alerta.appendChild(botao);
    overlay.appendChild(alerta);
    document.body.appendChild(overlay);
}