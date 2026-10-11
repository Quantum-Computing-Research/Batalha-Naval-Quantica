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

Hardware tem imagens ampliadas e ranking/fila ficam apenas junto ao seletor.
O painel da partida agrupa circuito, turno, status, ataque e frota adversaria.
Com janela de pelo menos 1280px e proporcao largura/altura >= 8/5, fica a
direita dos tabuleiros. Em janelas mais quadradas, verticais ou estreitas,
fica acima. A alternancia e CSS: redimensionar nao recria o estado do jogo.

A frota ilustra os tamanhos sem revelar posicoes. A API atualiza o estado
Afundado somente quando todas as casas do navio forem atingidas, inclusive
quando navios distintos estiverem encostados. Partidas antigas sem registro
individual dos navios mostram frota indisponivel, sem inferir posicoes.

Modo Plus adiciona busca classica apos acerto quantico. O painel NAND e uma
ilustracao, nao uma netlist funcional do algoritmo. Tem tantos bits de saida
quanto qubits do circuito, destaca o ataque classico e conserva o alvo entre
turnos. O certificado distingue a dificuldade e as fontes dos ataques.
