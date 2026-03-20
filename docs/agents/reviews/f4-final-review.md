# F4 Task 5 — Hardening final e decisão de fase

Data: 2026-03-20  
Task: F4 / Task 5 (`docs/agents/plans/f4-calibracao-dificuldade.md`)

## Evidência de execução

Comando principal (consolidado):

```bash
bun run hardening:f3.2
```

Resumo técnico do run (`artifacts/hardening/f3.2/latest/summary.json`):
- `aggregate.ok=true` (pipeline executou sem erro de comando)
- checks PASS:
  - `bun test src/games/dominorio/ai/v1-adapter.test.ts`
  - `bun test src/games/atari-go/ai/v1-adapter.test.ts`
  - `bun run baseline:dominorio`
  - `bun run baseline:atari-go`

Artefactos gerados/atualizados neste run:
- `artifacts/hardening/f3.2/2026-03-20T01-16-20/summary.json`
- `artifacts/hardening/f3.2/latest/summary.json`
- `artifacts/dominorio-baseline/2026-03-20T01-15-53/*`
- `artifacts/dominorio-baseline/latest/*`
- `artifacts/atari-go-baseline/2026-03-20T01-16-20/baseline.json`
- `artifacts/atari-go-baseline/latest/baseline.json`

## Estado dos critérios de saída da F4

Referência: `docs/agents/ROADMAP-CRJM.md` e plano F4.

### Dominório
- T1 (`N2>N1`, `N3>N2`, `N4>N3`, `N5>N4` >= 60%): **FAIL**
  - Falhas: `N2>N1`, `N4>N3`, `N5>N4`
- T4 (estabilidade/repetibilidade <= 15%): **FAIL**
  - Resultado atual: `45.83%` divergência (`artifacts/dominorio-baseline/latest/baseline.md`)

### Atari Go
- Consistência ladder (N-C2/N-C3, critério F3.2 usado como gate operacional): **FAIL**
  - `nC2Pass=false`
  - `nC3Pass=false`
- T1 ladder >= 60%: **FAIL** (todos os pares falham no snapshot atual)

### Baseline atualizado e publicado
- **PASS**: baseline novo foi gerado e está disponível em `latest` para ambos os jogos.

## Decisão explícita

**F4 não concluída.**  
Abrir sub-bloco:
- **F4.1 (ativo):** fechar lacunas de T1/T4 em Dominório
- **F4.2 (seguinte):** restaurar consistência ladder N-C2/N-C3 em Atari Go

Sem blocker técnico de execução nesta task; o bloqueio é de critério de qualidade (métricas abaixo do gate).
