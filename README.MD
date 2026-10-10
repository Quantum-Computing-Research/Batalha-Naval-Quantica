# Batalha Naval Quantica - Frontend

Abra index.html no navegador. O endpoint fica em scripts/url_backend.js.
Tamanhos 4x4, 8x8 e 16x16 correspondem a 4, 6 e 8 qubits no modelo H + medicao.
O circuito fica visivel durante o jogo; a leitura destaca os bits do ataque
selecionado, com linha antes de coluna. A v0 usa dados sinteticos, nao QPU.

O certificado preserva os tabuleiros reais com os foguinhos e inclui circuito,
estatisticas de jogo e analise descritiva das medicoes brutas quando disponivel.
PNG captura os tabuleiros e o relatorio; JSON inclui historico e medicoes.
Os resultados podem ser recuperados localmente antes de iniciar outra partida.
A captura usa html-to-image 1.11.13, distribuido em assets/vendor com licenca.

## Apresentacao

Layout responsivo com hardware, configuracao, circuito compacto e tabuleiros.
Os qubits aparecem em sequencia unica, com Hadamard e simbolo de medicao.
Metadados e probabilidades ficam ao lado do circuito em desktop e abaixo no
celular. Tabuleiros grandes usam rolagem local, sem alargar a pagina.
Os icones usam Lucide 0.468.0 local, com licenca em assets/vendor.
