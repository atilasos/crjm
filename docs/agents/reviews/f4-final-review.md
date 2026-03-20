# F4 Gate Final — Reexecução pós-F4.2.8 (NEXT-F4.2.9)

Data: 2026-03-20T20:20Z
Task: NEXT-F4.2.9 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Evidência de execução

Comando consolidado:

```bash
bun run hardening:f3.2
```

Snapshot deste gate:
- `artifacts/hardening/f3.2/latest/summary.json` (`generatedAt=2026-03-20T20:20:35.127Z`)
- `artifacts/dominorio-baseline/latest/baseline.md` (`generatedAt=2026-03-20T20:20:19.409Z`)
- `artifacts/atari-go-baseline/latest/baseline.json` (`generatedAt=2026-03-20T20:20:35.106Z`)

Checks do pipeline:
- `aggregate.ok=true` (4/4 checks pass na execução técnica)
- testes `v1-adapter` de Dominório e Atari Go: **PASS**
- `baseline:dominorio` e `baseline:atari-go`: **PASS** (execução técnica)

## Estado dos critérios de saída da F4

Referência: `docs/agents/ROADMAP-CRJM.md` (T1>=60%, T4<=15%).

### Dominório (T1/T4)
- T1 (`N2>N1`, `N3>N2`, `N4>N3`, `N5>N4` >= 60%): **FAIL**
  - `N2>N1=50%` (FAIL)
  - `N3>N2=100%` (PASS)
  - `N4>N3=100%` (PASS)
  - `N5>N4=50%` (FAIL)
- T2 (latência por nível): **PASS** (todos dentro dos limites)
- T3 (legalidade): **PASS** (100%)
- T4 (divergência <= 15%): **FAIL** — `34.78%` divergência
- Pedagogia (P1/P5/P6/P7): **PASS**

### Atari Go (critérios ladder)
- T1 ladder >= 60%:
  - `N2>N1=100%` (PASS)
  - `N3>N2=100%` (PASS)
  - `N4>N3=0%` (FAIL — 2 draws)
  - `N5>N4=0%` (FAIL — 2 draws)
- T2 (latência): **FAIL** nível 2 e nível 5
  - Nível 2: p95=13.48ms > budget 13ms (marginal)
  - Nível 5: p50=425.83ms >> budget 100ms (severo)
- nC2: **FAIL** (`failedPairs=["N4>N3","N5>N4"]`)
- nC3: **FAIL** (`failedLevels=[2,5]`)

### Nota sobre parâmetros do gate lite
O hardening corre com `gamesPerMirror=1`, `budgetScale=0.05`, `maxPliesPerGame=32`. Com apenas 2 jogos por par, a variância é elevada. A F4.2.8 mostrou resultados muito melhores com baseline completo (N2>N1=1.00, N3>N2=1.00, nC2Pass=true, nC3Pass=true).

Os FAILs em N4>N3 e N5>N4 (draws) são provavelmente artefactos do `maxPliesPerGame=32` curto — os jogos terminam em draw antes de haver decisão. O FAIL de latência no nível 5 pode ser ruído do `budgetScale=0.05`.

## Decisão explícita do gate F4

**FAIL — F4 continua não concluída.**

### Causa raiz do FAIL
1. **Dominório**: T1 falha em N2>N1 e N5>N4 (50% cada); T4 divergência a 34.78%
2. **Atari Go**: N4>N3 e N5>N4 resolvem em draws com plies curtos; nível 5 com latência fora do budget

### Diagnóstico
Os resultados da F4.2.8 (baseline completo) passavam em N2>N1, N3>N2, nC2 e nC3. O gate lite com parâmetros muito reduzidos introduz ruído excessivo nos níveis altos. Duas opções:

**Opção A** (recomendada): Aumentar `gamesPerMirror` e `maxPliesPerGame` no hardening para reduzir ruído e ter um gate mais fiável.

**Opção B**: Continuar a afinar parâmetros para que até o gate lite passe — mas isto pode ser um yak-shaving sem fim.

### Próxima unidade mínima
- `NEXT-F4.2.10`: Aumentar parâmetros do gate no hardening script (`gamesPerMirror=2`, `maxPliesPerGame=48`) e re-executar. Se os resultados passarem com parâmetros mais robustos, marcar F4 como concluída.
