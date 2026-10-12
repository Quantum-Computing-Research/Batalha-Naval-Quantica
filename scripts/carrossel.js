const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const carousel = document.querySelector('.carousel');

function atualizarNavegacaoCarrossel() {
    const temOverflow = carousel.scrollWidth > carousel.clientWidth + 1;
    prevButton.hidden = !temOverflow;
    nextButton.hidden = !temOverflow;
    prevButton.disabled = !temOverflow || carousel.scrollLeft <= 1;
    nextButton.disabled = !temOverflow || carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1;
}

function limitarQuantidadeNavios() {
    const tabuleiro = Number(document.getElementById("tamanhoTabuleiro").value);
    const seletor = document.getElementById("numNavios");
    const limite = Math.min(tabuleiro, seletor.options.length);
    for (const opcao of seletor.options) {
        opcao.disabled = Number(opcao.value) > limite;
    }
    if (Number(seletor.value) > limite) seletor.value = String(limite);
}

prevButton.addEventListener('click', () => {
    // Subtrai um valor do scroll horizontal (ajuste se necessário)
    carousel.scrollBy({ left: -300, behavior: 'smooth' });
});

nextButton.addEventListener('click', () => {
    // Adiciona um valor ao scroll horizontal (ajuste se necessário)
    carousel.scrollBy({ left: 300, behavior: 'smooth' });
});

carousel.addEventListener('scroll', atualizarNavegacaoCarrossel, { passive: true });
window.addEventListener('resize', atualizarNavegacaoCarrossel);
new ResizeObserver(atualizarNavegacaoCarrossel).observe(carousel);
carousel.querySelectorAll('img').forEach(imagem => imagem.addEventListener('load', atualizarNavegacaoCarrossel));
atualizarNavegacaoCarrossel();
requestAnimationFrame(atualizarNavegacaoCarrossel);

document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
        const carousel = document.querySelector('.carousel');
        if (!carousel.classList.contains('modo-selecao-ativo')) {
            carousel.classList.add('modo-selecao-ativo');
        }

        // Aqui você pode atualizar as classes .selecionado normalmente
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selecionado'));
        card.classList.add('selecionado');
        if (!getGameId()) {
            hardwareCircuitoAtual = card.dataset.backend;
            atualizarCircuitoPartida(circuitoAtual);
        }
    });
});

document.getElementById("tamanhoTabuleiro").addEventListener("change", () => {
    limitarQuantidadeNavios();
});
limitarQuantidadeNavios();