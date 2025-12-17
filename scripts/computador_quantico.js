let backendSelecionado = null;

function selecionarBackend(backend) {
    backendSelecionado = backend;
    const ids = ['sv1', 'dm1', 'tn1'];
    ids.forEach(id => {
        const img = document.getElementById(`img-${id}`);
        img.classList.toggle("selected", id === backend);
    });
}
