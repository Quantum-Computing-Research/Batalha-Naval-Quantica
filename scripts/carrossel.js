const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const carousel = document.querySelector('.carousel');

prevButton.addEventListener('click', () => {
    // Subtrai um valor do scroll horizontal (ajuste se necessário)
    carousel.scrollBy({ left: -300, behavior: 'smooth' });
});

nextButton.addEventListener('click', () => {
    // Adiciona um valor ao scroll horizontal (ajuste se necessário)
    carousel.scrollBy({ left: 300, behavior: 'smooth' });
});

document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
        const carousel = document.querySelector('.carousel');
        if (!carousel.classList.contains('modo-selecao-ativo')) {
            carousel.classList.add('modo-selecao-ativo');
        }

        // Aqui você pode atualizar as classes .selecionado normalmente
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selecionado'));
        card.classList.add('selecionado');
    });
});