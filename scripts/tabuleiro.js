function renderizarTabuleiro(containerElement, tamanho, idTabuleiro) {
    containerElement.innerHTML = ''; // Limpa o container
    containerElement.id = idTabuleiro; // ← atribui dinamicamente o ID

    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Linha superior com labels numéricos
    const linhaLabelsHorizontais = document.createElement('div');
    linhaLabelsHorizontais.classList.add('linha', 'label');

    const celulaVazia = document.createElement('div');
    celulaVazia.classList.add('celula', 'label');
    linhaLabelsHorizontais.appendChild(celulaVazia);

    for (let j = 0; j < tamanho; j++) {
        const celulaLabel = document.createElement('div');
        celulaLabel.classList.add('celula', 'label');
        celulaLabel.textContent = (j + 1);
        linhaLabelsHorizontais.appendChild(celulaLabel);
    }

    containerElement.appendChild(linhaLabelsHorizontais);

    // Grid com labels verticais
    for (let i = 0; i < tamanho; i++) {
        const linha = document.createElement('div');
        linha.classList.add('linha');

        const celulaLabelVertical = document.createElement('div');
        celulaLabelVertical.classList.add('celula', 'label');
        celulaLabelVertical.textContent = letras[i];
        linha.appendChild(celulaLabelVertical);

        for (let j = 0; j < tamanho; j++) {
            const celula = document.createElement('div');
            celula.classList.add('celula');
            celula.dataset.row = i;
            celula.dataset.col = j;
            linha.appendChild(celula);
        }

        containerElement.appendChild(linha);
    }

    // function mostrarConsentimento() {
    //     document.getElementById("consentimentoModal").style.display = "flex";
    // }   
}

document.addEventListener('DOMContentLoaded', () => {
    const playerBoard = document.getElementById('playerBoard');
    const computerBoard = document.getElementById('computerBoard');
    const tamanhoSelect = document.getElementById('tamanhoTabuleiro');
    const boardsContainer = document.querySelector('.boards'); // Container que envolve ambos os tabuleiros

    tamanhoSelect.addEventListener('change', function () {
        const tamanho = parseInt(this.value);
        const containerJogador = document.querySelector('.tabuleiro-jogador');
        const containerComputador = document.querySelector('.tabuleiro-computador');

        renderizarTabuleiro(containerJogador, tamanho, 'playerBoard');
        renderizarTabuleiro(containerComputador, tamanho, 'computerBoard');

        // Calcula o tamanho total do tabuleiro (supondo 40px por célula)
        const boardSize = tamanho * 40;
        // Define um gap proporcional (por exemplo, 10% do tamanho do tabuleiro)
        const gap = boardSize * 0.1;
        boardsContainer.style.gap = gap + 'px';
    });
});

const tamanhoSelect = document.getElementById('tamanhoTabuleiro');
const boardsContainer = document.querySelector('.boards'); // Container que envolve ambos os tabuleiros

tamanhoSelect.addEventListener('change', function () {
    const tamanho = parseInt(this.value);
    const containerJogador = document.querySelector('.tabuleiro-jogador');
    const containerComputador = document.querySelector('.tabuleiro-computador');

    renderizarTabuleiro(containerJogador, tamanho, 'playerBoard');
    renderizarTabuleiro(containerComputador, tamanho, 'computerBoard');

    // Calcula o tamanho total do tabuleiro (supondo 40px por célula)
    const boardSize = tamanho * 40;
    // Define um gap proporcional (por exemplo, 10% do tamanho do tabuleiro)
    const gap = boardSize * 0.1;
    boardsContainer.style.gap = gap + 'px';
});