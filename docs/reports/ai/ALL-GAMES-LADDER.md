# Relatório comum das IAs — latência e ladder N1–N5

Data da última execução: 2026-07-10

## Resultado executivo

- Legalidade e latência: **PASS**. Trinta decisões iniciais (seis jogos × cinco níveis), zero jogadas ilegais e todos os p95 abaixo de `2 × budget + 100 ms`.
- Interface: **PASS**. Os seis jogos aceitaram uma jogada e o laboratório resolveu um puzzle em `1440×900`, `1024×768` e `390×844`: 21 percursos sem erro de browser nem overflow horizontal.
- Ladder smoke atual: 19/24 pares adjacentes passaram, em 48 partidas espelhadas; zero jogadas ilegais.
- Perfil classroom conjunto: 22/24 pares passaram em 144 partidas. Foi executado antes dos últimos ajustes localizados de Dominório e Nex; continua válido para os outros quatro jogos.
- Perfis classroom finais focados: Quelhas 4/4, Dominório 3/4 e Nex 3/4. Dominório oscilou entre 3/4 e 4/4 em repetições iguais; Nex N5–N4 ficou 3–3.

Conclusão permitida: N1–N5 são distintos por política, profundidade/candidatos e budget, respondem dentro do gate e não produziram lances ilegais. As amostras demonstram escada completa de forma consistente em Quelhas e forte separação na maioria dos pares. Não demonstram ainda superioridade estatística de todos os níveis adjacentes em todos os jogos.

## Latência do fallback TypeScript

| Jogo | N1 / 100 ms | N2 / 250 ms | N3 / 500 ms | N4 / 1000 ms | N5 / 2000 ms | Legalidade |
|---|---:|---:|---:|---:|---:|---:|
| Gatos & Cães | 119,08 ms | 253,88 ms | 503,38 ms | 1004,48 ms | 2009,28 ms | 0 ilegais |
| Dominório | 5,31 ms | 1,51 ms | 1,07 ms | 1001,72 ms | 2000,69 ms | 0 ilegais |
| Quelhas | 118,20 ms | 264,71 ms | 513,07 ms | 1014,57 ms | 2000,69 ms | 0 ilegais |
| Produto | 6,74 ms | 2,64 ms | 71,28 ms | 74,00 ms | 83,32 ms | 0 ilegais |
| Atari Go | 100,02 ms | 85,21 ms | 85,13 ms | 257,20 ms | 323,98 ms | 0 ilegais |
| Nex | 27,38 ms | 30,51 ms | 44,29 ms | 49,28 ms | 117,44 ms | 0 ilegais |

O Bun mede o fallback TypeScript porque não oferece o `Worker` do browser. No browser, os cálculos decorrem nos workers empacotados; esse caminho foi validado pelo smoke interactivo.

## Ladder smoke atual

O perfil executa duas partidas por par, com lados trocados e 2% dos budgets. É um detector rápido de regressões, não uma estimativa estatística de força.

| Jogo | N2>N1 | N3>N2 | N4>N3 | N5>N4 | Pares aprovados |
|---|---:|---:|---:|---:|---:|
| Gatos & Cães | 1,00 | 0,50 | 1,00 | 1,00 | 3/4 |
| Dominório | 1,00 | 1,00 | 0,50 | 1,00 | 3/4 |
| Quelhas | 1,00 | 1,00 | 1,00 | 1,00 | 4/4 |
| Produto | 1,00 | 0,50 | 0,50 | 0,50 | 1/4 |
| Atari Go | 1,00 | 1,00 | 0,75 | 0,75 | 4/4 |
| Nex | 1,00 | 0,75 | 0,75 | 1,00 | 4/4 |

## Perfil classroom e limites

O perfil conjunto usa seis partidas por par e 10% dos budgets. Gatos & Cães, Quelhas, Produto e Atari Go passaram 4/4 nessa execução; Dominório e Nex passaram 3/4. Os resultados focados posteriores mostram que um único par pode mudar entre repetições por deadline/seed, sobretudo em jogos com forte vantagem de abertura.

1. Seis partidas por par continuam muito abaixo das 200 partidas definidas na matriz técnica para uma alegação estatística.
2. Dominório 8×8 é vitória demonstrada do primeiro jogador; resultados espelhados curtos podem medir mais a abertura do que a diferença entre N4/N5.
3. Nex N5 analisa mais candidatos/substituições e tem o dobro do budget de N4, mas a amostra focada N5–N4 terminou 3–3. A superioridade desse par fica não demonstrada.
4. Produto separou 4/4 no perfil classroom, embora o smoke de 2 ms–40 ms não dê tempo suficiente aos níveis intermédios para se distinguirem.
5. “Nível superior” significa maior intensidade de pesquisa e menos erros controlados; não é garantia de vitória em cada partida.

## Reprodução

```bash
bun run scripts/ai-latency.ts --profile smoke --output docs/reports/ai/latency-smoke.json
bun run scripts/ai-ladder.ts --profile smoke --output docs/reports/ai/ladder-smoke.json
bun run scripts/ai-ladder.ts --profile classroom --games-per-mirror 3 --output docs/reports/ai/ladder-classroom.json
bun run classroom:ui-smoke
```

Dados completos: `latency-smoke.json`, `ladder-smoke.json`, `ladder-classroom.json`, `dominorio-classroom.json`, `quelhas-classroom.json` e `nex-classroom.json` nesta pasta.
