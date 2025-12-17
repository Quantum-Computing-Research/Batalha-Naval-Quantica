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

