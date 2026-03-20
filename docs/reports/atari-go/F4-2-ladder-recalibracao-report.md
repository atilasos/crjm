# F4.2.3 — Atari Go ladder recalibração report

Data: 2026-03-20
Fase: F4 — Calibração de dificuldade e estabilidade
Task: F4.2.3

## Comandos executados

```bash
bun run baseline:atari-go
bun test scripts/atari-go-ladder-baseline.test.ts
```

## Artefactos atualizados

- `artifacts/atari-go-baseline/latest/baseline.json`
- `artifacts/atari-go-baseline/2026-03-20T07-20-27/` (snapshot datado)

## Resultado pós-ajuste (baseline atual)

Fonte: `artifacts/atari-go-baseline/latest/baseline.json`

- Totais: `games=40`, `decisions=2210`
- `nC2Pass=true` (`failedPairs=[]`)
- `nC3Pass=false` (`failedLevels=[3]`)

### Tendência T1 ladder (pares definidos)

- N2 > N1: `10/10` vitórias do nível forte (`100%`) ✅
- N3 > N2: `10/10` (`100%`) ✅
- N4 > N3: `10/10` (`100%`) ✅
- N5 > N4: `10/10` (`100%`) ✅

Conclusão T1 local: **PASS** em todos os pares (>=60%).

## Decisão de desbloqueio F4

**Decisão:** iterar F4.2 (não voltar ainda à Task 5).

Racional:
- T1 está forte e consistente no snapshot atual.
- `nC3Pass` mantém FAIL no nível 3, portanto o critério de estabilidade/consistência do ladder ainda não está fechado para gate final F4.
- Próxima unidade recomendada: ajuste mínimo adicional em F4.2 para fechar `failedLevels=[3]`, seguido de novo baseline Atari Go.
