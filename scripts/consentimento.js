function consentimento() {
    // 1. Encontre o card selecionado usando a classe 'selecionado'
    const hardwareSelecionado = document.querySelector('.card.selecionado');

    // 2. Se nenhum card foi selecionado, exiba um alerta
    if (!hardwareSelecionado) {
        alert("Selecione um hardware quântico como oponente!");
        return; // Retorna para interromper a função
    }

    // 3. Se um hardware foi selecionado, chame a função consentimento()
    document.getElementById("consentimentoModal").style.display = "flex";
}

