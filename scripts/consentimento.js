function consentimento() {
    // 1. Encontre o card selecionado usando a classe 'selecionado'
    const hardwareSelecionado = document.querySelector('.card.selecionado');

    // 2. Se nenhum card foi selecionado, exiba um alerta
    if (!hardwareSelecionado) {
        alert("Selecione um hardware quântico como oponente!");
        return; // Retorna para interromper a função
    }

    const modal = document.getElementById("consentimentoModal");
    const simulado = getModoSelecionado() === "simulador";
    document.getElementById("consentimentoTitulo").textContent = t(simulado ? "Divirta-se!" : "Participar do experimento");
    document.getElementById("consentimentoNomePrompt").textContent = t(simulado ? "Digite seu nome" : "Digite seu nome:");
    modal.querySelector(".mensagem").hidden = simulado;
    document.getElementById("cancelarConsentimento").hidden = simulado;
    modal.style.display = "flex";
}

