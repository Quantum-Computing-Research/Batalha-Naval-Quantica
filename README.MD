# Batalha Naval Quantica - Serverless

API Gateway HTTP API -> Lambda `infra/lambda/jogo` -> DynamoDB (partidas)
e S3 (cache, historico e documentos dos jogadores).

## Jogar

No frontend, `Usar dados simulados` inicia uma partida com uma permutacao
aleatoria de todas as coordenadas do tabuleiro. E uma simulacao classica,
nao uma execucao de hardware quantico. O modo fica registrado na partida.
Nao dispara tarefas Braket nem gera custos de QPU.

Desmarcar a opcao exige selecionar um hardware e ter cache no S3.
O handler aceita `cache/<hardware>/tamanho_<N>.json`,
`cache/<hardware>/<N>.json` e o legado `cache/<hardware>.json`.
Aceita listas de coordenadas, `moves`, bitstrings em
`data.tamanho_tabuleiro_<N>` e `dados_randomicos_gerados` com coordenadas.
Cache ausente permanece offline; esgotamento encerra sem vencedor.

Tabuleiros de 4 a 20 sao suportados, com 1 a N navios de tamanhos 1 a N.
Nao e necessario usar potencias de 2: com `ceil(log2(N))` qubits por eixo,
descartam-se resultados >= N, sem aplicar modulo (que introduziria vies).
Bitstrings precisam ter exatamente duas vezes esse numero de bits.
Para hardware real, o produtor ainda precisa repor resultados rejeitados e
coordenadas repetidas; o consumo de cache nao dispara tarefas automaticamente.

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
