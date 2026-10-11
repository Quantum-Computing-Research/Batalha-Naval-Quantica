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

Selecione um hardware para associar a partida ao seu perfil de cache.
No modo v0, se nao existir cache para o hardware e tabuleiro selecionados,
o handler gera uma permutacao sintetica das coordenadas e a grava no S3 em
`cache/<hardware>/<tamanho>.json`. As partidas seguintes reutilizam esse
arquivo como mock QPU, sem chamar Braket nem gerar custos.
O handler aceita `cache/<hardware>/tamanho_<N>.json`,
`cache/<hardware>/<N>.json` e o legado `cache/<hardware>.json`.
Aceita listas de coordenadas, `moves`, bitstrings em
`data.tamanho_tabuleiro_<N>` e `dados_randomicos_gerados` com coordenadas.
O endpoint `/cache` considera disponiveis os hardwares suportados pelo gerador
v0. Esgotamento da lista de jogadas encerra sem vencedor.

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

## Plus - dificil

POST /iniciar_jogo aceita dificuldade normal ou plus. Plus inicia com ataque
quantico; um acerto ativa a busca classica no navio atingido. Ela tenta casas
ortogonais nao atacadas, infere orientacao apos dois acertos e busca extremos.
Um erro passa a vez ao jogador sem descartar o alvo. O quântico retorna apos
afundamento; navios de uma casa nao mantem o chip ativo. A busca nao consome
a pilha quantica. Identidade interna do navio confirma acertos e afundamento,
mas as casas candidatas sao geradas a partir dos acertos, nao das casas ocultas.
Estado chip_classico persiste no DynamoDB. Historico distingue ataque_classico
de ataque_quantico, e analise usa somente medicoes brutas, nao ataques de busca.

## Pontuacao e ranking

Cada acerto vale 1 ponto. Em vitorias por jogadas, ha bonus de tempo de ate 60
pontos: 1 ponto por cada 10 segundos abaixo de 10 minutos. Cada ataque acima do
minimo teorico (total de casas ocupadas pela frota adversaria) tira 1 ponto.
Derrotas e partidas abandonadas mantem somente os pontos dos acertos. Vitorias
por codigo secreto nao recebem bonus ou penalidade de eficiencia.

A pontuacao e incluida no resumo e no certificado. O arquivo completo continua
em `partidas/{partida_id}.json`; `jogadores/{jogador_id}.json` guarda os pontos
totais, melhor partida, vitorias, derrotas e referencias das partidas. O ranking
mostra os dez maiores totais, lidos desses documentos no S3. A finalizacao e
idempotente por identificador da partida. Pontos de partidas antigas nao sao
recalculados e preservam o criterio anterior de um ponto por acerto.

## Analise de aleatoriedade por hardware

`GET /analises` lista os hardwares com partidas arquivadas. Com `hardware` e
`tamanho_tabuleiro` (4, 8 ou 16), agrega as coordenadas de ataque quantico das
partidas em `partidas/{partida_id}.json`. O campo `backend` preserva o hardware
selecionado mesmo em modo simulador. A analise exclui partidas cujo backend e
`simulador`, mas inclui partidas com hardware selecionado mesmo quando `modo`
e `simulador` (marcadas como amostras de teste). Ataques classicos do modo Plus
tambem ficam fora da amostra. `tamanho_tabuleiro=todos` combina os
tamanhos usando coordenadas relativas numa grade 16x16 e um baseline esperado
ponderado pelas amostras e pelo espaco de cada tamanho; entropia e Hamming sao
normalizados, e as metricas de cada tamanho continuam disponiveis separadas.
A resposta inclui distribuicao de Hamming, frequencia e
entropia por bit, frequencias por casa, qui-quadrado, repeticoes, min-entropia
e entropia de colisao empiricas, alem das partidas que formaram a amostra.

O estudo de Liu et al., Nature 640 (2025), doi:10.1038/s41586-025-08737-1,
usa XEB por circuito (que requer a probabilidade ideal `p_C(x)`), tempo medio
de resposta do QPU (`tQC`) e limites de min-entropia suave sob um modelo
explicito de adversario e extractor. Os registros atuais nao guardam circuitos
aleatorios por amostra nem `p_C(x)`; o jogo usa uma medicao Hadamard de saida
uniforme, para a qual XEB nao discrimina o comportamento observado. Tambem nao
registramos a duracao de execucao individual do QPU nem executamos um protocolo
de extracao/certificacao. Por isso a API sinaliza XEB, tQC e min-entropia
certificada como indisponiveis; os demais indices sao descritivos e nao
certificam aleatoriedade quantica.
