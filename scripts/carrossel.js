const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const carousel = document.querySelector('.carousel');

const tarifasBraket = {
    aqt_ibex_q1: { nome: "AQT IBEX-Q1", porShot: 0.0235 },
    ionq_forte: { nome: "IonQ Forte", porShot: 0.08 },
    iqm_emerald: { nome: "IQM Emerald", porShot: 0.0016 },
    iqm_garnet: { nome: "IQM Garnet", porShot: 0.00145 },
    quera_aquila: { nome: "QuEra Aquila", porShot: 0.01 },
    rigetti_cepheus: { nome: "Rigetti Cepheus", porShot: 0.000425 },
};

function atualizarEstimativaPreco() {
    const campo = document.getElementById("precoPartida");
    if (!campo) return;
    const tabuleiro = Number(document.getElementById("tamanhoTabuleiro").value);
    const numNavios = Number(document.getElementById("numNavios").value);
    const ajudaClassica = document.getElementById("dificuldade").value === "plus";
    const shotsMinimos = ajudaClassica ? numNavios : numNavios * (numNavios + 1) / 2;
    const shotsMaximos = tabuleiro * tabuleiro;
    const hardware = document.querySelector(".card.selecionado")?.dataset.backend;
    const tarifa = tarifasBraket[hardware];
    const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 });
    if (!tarifa) {
        campo.value = "Selecione um hardware para calcular a tarifa.";
        return;
    }
    const custoMinimo = shotsMinimos * tarifa.porShot;
    const custoMaximo = shotsMaximos * tarifa.porShot;
    campo.value = `${tarifa.nome} · ${usd.format(tarifa.porShot)}/shot · ${shotsMinimos}–${shotsMaximos} shots · ${usd.format(custoMinimo)}–${usd.format(custoMaximo)}`;
}

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
        atualizarEstimativaPreco();
        if (!getGameId()) {
            hardwareCircuitoAtual = card.dataset.backend;
            atualizarCircuitoPartida(circuitoAtual);
        }
    });
});

document.getElementById("tamanhoTabuleiro").addEventListener("change", () => {
    limitarQuantidadeNavios();
    atualizarEstimativaPreco();
});
document.getElementById("numNavios").addEventListener("change", atualizarEstimativaPreco);
document.getElementById("dificuldade").addEventListener("click", atualizarEstimativaPreco);
limitarQuantidadeNavios();
atualizarEstimativaPreco();