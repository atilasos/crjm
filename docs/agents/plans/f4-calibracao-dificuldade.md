# F4 — Calibração de dificuldade e estabilidade

> Para agentes ACP: executar incrementalmente, uma tarefa de cada vez, com commits/push por unidade lógica. Não saltar passos. Não fazer big-bang refactor.

**Goal:** tornar a escada N1–N5 observável e estável em Dominório e Atari Go.

**Architecture:** ajustar budgets, heurísticas e critérios de benchmark sem reescrever motores. Cada alteração deve produzir baseline novo e comparação explícita com o baseline anterior.

**Tech Stack:** TypeScript, Bun tests, scripts baseline/hardening, artifacts markdown/json/csv.

---

## Critério de pronto desta fase
- Dominório: T1 N2>N1, N3>N2, N4>N3, N5>N4 ≥ 60%
- Atari Go: ladder consistency aceitável nos níveis definidos em F3.2
- T4 repetibilidade/estabilidade <= 15% divergência
- Novo relatório comparativo guardado em `docs/reports/`

---

## Task 1 — Auditoria dos parâmetros atuais

**Files:**
- Read: `src/ai-core/difficulty.ts`
- Read: `src/games/dominorio/ai/*`
- Read: `src/games/atari-go/ai/*`
- Read: `artifacts/dominorio-baseline/latest/baseline.md`
- Read: `scripts/atari-go-ladder-baseline.ts`
- Write: `docs/agents/reviews/f4-01-auditoria-parametros.md`

- [ ] Mapear budgets, randomness, depth, topN, heurísticas por nível
- [ ] Identificar por que N3–N5 colapsam em Dominório
- [ ] Identificar gap Atari Go N-C2/N-C3
- [ ] Guardar diagnóstico curto com hipóteses acionáveis
- [ ] Commit + push

## Task 2 — Ajuste incremental Dominório (budgets/variação)

**Files:**
- Modify: `src/games/dominorio/ai/types.ts`
- Modify: `src/games/dominorio/ai/v1-adapter.ts`
- Test: `src/games/dominorio/ai/*.test.ts`

- [ ] Ajustar presets para separar melhor níveis adjacentes
- [ ] Se necessário, reduzir aleatoriedade mal calibrada nos níveis médios/altos
- [ ] Manter UX e contrato V1 compatíveis
- [ ] Correr testes relevantes
- [ ] Commit + push

## Task 3 — Baseline Dominório pós-ajuste

**Files:**
- Run: `baseline:dominorio` ou script equivalente
- Write/update: `artifacts/dominorio-baseline/latest/*`
- Write: `docs/reports/dominorio/F4-calibracao-report.md`

- [ ] Gerar novo baseline
- [ ] Comparar com baseline anterior
- [ ] Explicar PASS/FAIL por métrica T1–T4
- [ ] Commit + push

## Task 4 — Ajuste incremental Atari Go ladder

**Files:**
- Modify: `src/games/atari-go/ai/*`
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-04-atarigo-ajuste.md`

- [ ] Corrigir gap N-C2/N-C3 com mudança mínima e mensurável
- [ ] Atualizar teste(s) do ladder se necessário
- [ ] Correr testes relevantes
- [ ] Registar racional da mudança
- [ ] Commit + push

## Task 5 — Hardening final F4

**Files:**
- Run: `scripts/hardening-f3_2.ts` ou sucessor
- Write: `docs/agents/reviews/f4-final-review.md`

- [ ] Executar benchmark/hardening consolidado
- [ ] Verificar critérios de pronto da F4
- [ ] Se falhar, abrir sub-bloco F4.1 ou F4.2 no roadmap
- [ ] Se passar, marcar F4 concluída no roadmap
- [ ] Commit + push

---

## Regras de execução
- Uma task por execução do cron
- Não avançar para a próxima task sem artefacto de review/report da atual
- Sempre preferir mudanças pequenas em parâmetros e heurísticas antes de refactors maiores
- Se aparecer bloqueio conceptual, reportar ao Igor em vez de inventar
