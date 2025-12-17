function logBloco(titulo, dados, tipo = 'log') {
    console.groupCollapsed(titulo);
    if (Array.isArray(dados) && dados.every(row => Array.isArray(row))) {
        console.table(dados);
    } else {
        console[tipo](dados);
    }
    console.groupEnd();
}
