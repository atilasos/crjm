# Dominório Baseline Harness (F1.4)

## Comando

```bash
bun run baseline:dominorio
```

## Opções por ambiente

- `DOMINORIO_GAMES_PER_MIRROR` (default `8`): número de jogos por espelho em cada confronto N+1 vs N.
- `DOMINORIO_T4_PROBE_EVERY_PLY` (default `6`): frequência (em plies) para sonda de estabilidade T4.
- `DOMINORIO_MAX_PLIES` (default `64`): limite de plies por partida.
- `DOMINORIO_BUDGET_SCALE` (default `1`): escala multiplicativa do `timeBudgetMs` por nível (útil para corrida curta de baseline inicial).

Exemplo de corrida curta:

```bash
DOMINORIO_GAMES_PER_MIRROR=1 DOMINORIO_BUDGET_SCALE=0.05 bun run baseline:dominorio
```

## Saídas

Cada corrida escreve em:

- `artifacts/dominorio-baseline/<timestamp>/baseline.json`
- `artifacts/dominorio-baseline/<timestamp>/baseline.csv`
- `artifacts/dominorio-baseline/<timestamp>/baseline.md`

E atualiza snapshot:

- `artifacts/dominorio-baseline/latest/baseline.json`
- `artifacts/dominorio-baseline/latest/baseline.csv`
- `artifacts/dominorio-baseline/latest/baseline.md`

## Métricas cobertas

- Técnicas: `T1`, `T2`, `T3`, `T4`.
- Pedagógicas (proxies): `P1`, `P5`, `P6`, `P7`.

