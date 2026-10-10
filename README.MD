# Batalha Naval Quantica - Serverless

API Gateway HTTP API -> Lambda `infra/lambda/jogo` -> DynamoDB (partidas)
e S3 (cache, historico e documentos dos jogadores).

## Jogar

No frontend, `Dados sinteticos - v0` inicia uma partida com amostras
classicas independentes do modelo uniforme H + medicao. Cada lote tem
32 * N * N medicoes, incluindo repeticoes, na ordem de geracao.
A lista de ataques e deduplicada separadamente; o lote bruto nao e alterado.
Nao e uma execucao de hardware quantico. O modo fica registrado na partida.
Nao dispara tarefas Braket nem gera custos de QPU.

Desmarcar a opcao exige selecionar um hardware e ter cache no S3.
O handler aceita `cache/<hardware>/tamanho_<N>.json`,
`cache/<hardware>/<N>.json` e o legado `cache/<hardware>.json`.
Aceita listas de coordenadas, `moves`, bitstrings em
`data.tamanho_tabuleiro_<N>` e `dados_randomicos_gerados` com coordenadas.
Cache ausente permanece offline; esgotamento encerra sem vencedor.

Tabuleiros 4x4, 8x8 e 16x16 sao suportados, com 1 a N navios de tamanhos 1 a N.
Usam respectivamente 4, 6 e 8 qubits: log2(N) por eixo. No modelo ideal
uniforme cada celula tem probabilidade 1/(N*N), sem resultados fora da grade.
Bitstrings precisam ter exatamente duas vezes esse numero de bits.
Para hardware real, o produtor ainda precisa repor coordenadas repetidas e
preservar medicoes brutas ordenadas; o consumo de cache nao dispara tarefas.

## Testes

```sh
python3 -B -m unittest discover -s tests -v
```

Testes isolam AWS e cobrem inicio, turnos, vitoria, cache, persistencia do
estado e encerramento. O workflow executa os testes antes de publicar.
A publicacao usa commit/push pelo alias `u`; nao fazer deploy manual.

O backend_serverful deve permanecer ate validar o frontend com a Lambda
publicada, incluindo uma partida completa e os recursos de analise.
O diretorio `infra/lambda/jogadas` ainda contem o produtor antigo baseado
em arquivos e threads, e nao participa deste fluxo de jogo.

## Registro final

As respostas de vitoria e `/estado` incluem `resumo`: identificacao da
partida, adversario, modo, inicio/fim, duracao em segundos, jogadas,
acertos, erros, navios afundados, historico e os dois tabuleiros finais.
O resumo tambem integra o documento da partida salvo no S3.
Navios sao identificados pelas celulas originais; partidas anteriores a
esse registro retornam `null` na contagem de navios afundados.

O frontend preserva os tabuleiros, aguarda 3 segundos e abre o resultado.
Permite baixar PNG ou JSON, recupera o resultado local apos recarregar
e so limpa a tela quando o jogador escolhe Nova partida.

## Circuito e analise

`circuito` acompanha o inicio, o estado e o resumo. O diagrama HTML mostra
H e medicao por qubit, os eixos e os bits do ultimo ataque selecionado.
No cache legado o circuito e apenas uma referencia, nao uma execucao verificada.
Aquila usa computacao analogica: a futura integracao real deve ter um modelo
especifico em vez de representar esse dispositivo como circuito de portas.

O resumo e o JSON incluem `medicoes_brutas` e `analise`, com frequencias por
celula em ordem de linha/coluna, repeticoes, qui-quadrado e graus de liberdade,
entropia de Shannon e correlacao de Pearson lag 1 sobre valores inteiros.
Sao indicadores descritivos sobre o lote inteiro; nao certificam aleatoriedade
quantica nem oferecem p-valor. Cache sem medicoes brutas retorna indisponivel,
sem analisar ataques deduplicados. O PNG inclui circuito e painel estatistico.
