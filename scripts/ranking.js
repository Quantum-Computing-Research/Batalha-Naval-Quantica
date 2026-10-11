function atualizarRanking(ranking) {
    const lista = document.getElementById("rankingList");
    lista.innerHTML = "";
    ranking.forEach((jogador, i) => {
        const li = document.createElement("li");
        li.textContent = `${jogador.nome} - ${jogador.pontos} pts`;
        li.style.fontWeight = "bold";
        if (i === 0) li.style.color = "gold";
        else if (i === 1) li.style.color = "silver";
        else if (i === 2) li.style.color = "brown";
        lista.appendChild(li);
    });
}

const rankingPopup = document.getElementById("rankingPopup");
const rankingButton = document.getElementById("rankingButton");

rankingButton.addEventListener("click", () => {
    if (rankingPopup.open) return;
    rankingPopup.showModal();
    rankingButton.setAttribute("aria-expanded", "true");
});

function fecharRanking() {
    rankingPopup.close();
    rankingButton.setAttribute("aria-expanded", "false");
    rankingButton.focus({ preventScroll: true });
}

document.getElementById("rankingCloseButton").addEventListener("click", fecharRanking);
rankingPopup.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        event.preventDefault();
        fecharRanking();
    }
});
rankingPopup.addEventListener("close", () => {
    rankingButton.setAttribute("aria-expanded", "false");
    rankingButton.focus({ preventScroll: true });
});
rankingPopup.addEventListener("click", event => {
    if (event.target !== rankingPopup) return;
    const limites = rankingPopup.getBoundingClientRect();
    if (event.clientX < limites.left || event.clientX > limites.right || event.clientY < limites.top || event.clientY > limites.bottom) fecharRanking();
});

