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

**Status (evidência já em `main`):** concluída — commit `7be4388`, review `docs/agents/reviews/f4-01-auditoria-parametros.md`.

**Files:**
- Read: `src/ai-core/difficulty.ts`
- Read: `src/games/dominorio/ai/*`
- Read: `src/games/atari-go/ai/*`
- Read: `artifacts/dominorio-baseline/latest/baseline.md`
- Read: `scripts/atari-go-ladder-baseline.ts`
- Write: `docs/agents/reviews/f4-01-auditoria-parametros.md`

- [x] Mapear budgets, randomness, depth, topN, heurísticas por nível
- [x] Identificar por que N3–N5 colapsam em Dominório
- [x] Identificar gap Atari Go N-C2/N-C3
- [x] Guardar diagnóstico curto com hipóteses acionáveis
- [x] Commit + push

## Task 2 — Ajuste incremental Dominório (budgets/variação)

**Status (evidência já em `main`):** concluída — commits `841b0e7` e `a7fc773`.

**Files:**
- Modify: `src/games/dominorio/ai/types.ts`
- Modify: `src/games/dominorio/ai/v1-adapter.ts`
- Test: `src/games/dominorio/ai/*.test.ts`

- [x] Ajustar presets para separar melhor níveis adjacentes
- [x] Se necessário, reduzir aleatoriedade mal calibrada nos níveis médios/altos
- [x] Manter UX e contrato V1 compatíveis
- [x] Correr testes relevantes
- [x] Commit + push

## Task 3 — Baseline Dominório pós-ajuste

**Status (evidência já em `main`):** concluída — commits `1807dfc` e `673d8f0`; report `docs/reports/dominorio/F4-calibracao-report.md`.

**Files:**
- Run: `baseline:dominorio` ou script equivalente
- Write/update: `artifacts/dominorio-baseline/latest/*`
- Write: `docs/reports/dominorio/F4-calibracao-report.md`

- [x] Gerar novo baseline
- [x] Comparar com baseline anterior
- [x] Explicar PASS/FAIL por métrica T1–T4
- [x] Commit + push

## Task 4 — Ajuste incremental Atari Go ladder

**Status (evidência já em `main`):** concluída — commit `5781003`, review `docs/agents/reviews/f4-04-atarigo-ajuste.md`.

**Files:**
- Modify: `src/games/atari-go/ai/*`
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-04-atarigo-ajuste.md`

- [x] Corrigir gap N-C2/N-C3 com mudança mínima e mensurável
- [x] Atualizar teste(s) do ladder se necessário
- [x] Correr testes relevantes
- [x] Registar racional da mudança
- [x] Commit + push

## Task 5 — Hardening final F4

**Status (evidência já em `main`):** executada com **FAIL** no gate F4 — commit `277464d`, review `docs/agents/reviews/f4-final-review.md`.

**Files:**
- Run: `scripts/hardening-f3_2.ts` ou sucessor
- Write: `docs/agents/reviews/f4-final-review.md`

- [x] Executar benchmark/hardening consolidado
- [x] Verificar critérios de pronto da F4
- [x] Se falhar, abrir sub-bloco F4.1 ou F4.2 no roadmap
- [ ] Se passar, marcar F4 concluída no roadmap (não aplicável neste ciclo)
- [x] Commit + push

---

## Próximo trabalho executável (sub-blocos pós-Task 5)

Estado de fase após Task 5: **FAIL** no gate F4; seguir execução incremental por sub-blocos.

### Próximas duas unidades (uma por execução)

#### NEXT-F4.1 — Dominório T1/T4: separar N4/N5 + reduzir variância de topo
**Files:**
- Modify: `src/games/dominorio/ai/types.ts`
- Modify: `src/games/dominorio/ai/v1-adapter.ts`
- Test: `src/games/dominorio/ai/*.test.ts`
- Artifact: `docs/agents/reviews/f4-1-2-dominorio-ajuste.md`

#### NEXT-F4.2 — Atari Go ladder: reforçar separação N2/N3 no baseline
**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Artifact: `docs/agents/reviews/f4-2-2-atarigo-ajuste.md`

### F4.1 (ativo) — Recalibração Dominório para fechar T1/T4

#### F4.1.1 — Reauditar baseline atual e definir alvo mínimo por par
**Files:**
- Read: `artifacts/dominorio-baseline/latest/baseline.md`
- Read: `docs/reports/dominorio/F4-calibracao-report.md`
- Write: `docs/agents/reviews/f4-1-1-dominorio-reauditoria.md`

**Checks:**
- [ ] Listar pares T1 em FAIL com delta para 60%
- [ ] Listar valor atual de T4 e gap para <=15%
- [ ] Definir hipótese única de ajuste para T1/T4 (sem refactor)

**Artefacto esperado:**
- [ ] Review curto com hipótese prioritária e critério de aceitação mensurável

#### F4.1.2 — Separar N4/N5 com ajuste mínimo e reduzir variância de topo
**Files:**
- Modify: `src/games/dominorio/ai/types.ts`
- Modify: `src/games/dominorio/ai/v1-adapter.ts`
- Test: `src/games/dominorio/ai/*.test.ts`

**Checks:**
- [ ] N4 e N5 deixam de partilhar preset efetivo no runtime
- [ ] Política de abertura/seleção para N4/N5 reduz aleatoriedade não necessária
- [ ] Testes Dominório relevantes passam

**Artefacto esperado:**
- [ ] Commit com diff mínimo + nota de racional em mensagem de commit

#### F4.1.3 — Regenerar baseline Dominório e validar gate local F4.1
**Files:**
- Run: `bun run baseline:dominorio`
- Write/update: `artifacts/dominorio-baseline/latest/*`
- Write: `docs/reports/dominorio/F4-1-dominorio-recalibracao-report.md`

**Checks:**
- [ ] Recalcular T1 por pares (`N2>N1`, `N3>N2`, `N4>N3`, `N5>N4`)
- [ ] Recalcular T4 (divergência)
- [ ] Decidir PASS/FAIL de F4.1 com evidência explícita

**Artefacto esperado:**
- [ ] Report com tabela antes/depois e decisão de continuação

### F4.2 (pendente) — Recalibração Atari Go ladder

#### F4.2.1 — Reauditar ladder atual e fixar objetivo N-C2/N-C3 por nível
**Files:**
- Read: `artifacts/atari-go-baseline/latest/baseline.json`
- Read: `scripts/atari-go-ladder-baseline.ts`
- Write: `docs/agents/reviews/f4-2-1-atarigo-reauditoria.md`

**Checks:**
- [ ] Identificar pares/níveis que causam `nC2Pass=false`
- [ ] Identificar níveis fora de budget que causam `nC3Pass=false`
- [ ] Definir ajuste mínimo prioritário para ladder

**Artefacto esperado:**
- [ ] Review com matriz FAIL atual + alvo concreto por métrica

#### F4.2.2 — Ajustar ladder com mudança mínima em separação média
**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-2-2-atarigo-ajuste.md`

**Checks:**
- [ ] Melhorar separação N-C2 (foco N2/N3) sem alterar contrato de output
- [ ] Manter shape de `baseline.json` compatível com hardening
- [ ] Teste do ladder passa

**Artefacto esperado:**
- [ ] Review com racional do ajuste e impacto esperado em N-C2/N-C3

#### F4.2.3 — Regenerar baseline Atari Go e decidir desbloqueio F4
**Files:**
- Run: `bun run baseline:atari-go`
- Write/update: `artifacts/atari-go-baseline/latest/baseline.json`
- Write: `docs/reports/atari-go/F4-2-ladder-recalibracao-report.md`

**Checks:**
- [ ] Validar `nC2Pass` e `nC3Pass` no snapshot pós-ajuste
- [ ] Confirmar tendência T1 ladder >=60% nos pares definidos
- [ ] Registar se F4 fica pronta para novo gate final

**Artefacto esperado:**
- [ ] Report com decisão: voltar a Task 5 (hardening final) ou iterar F4.2

---

## Regras de execução
- Uma task por execução do cron
- Não avançar para a próxima task sem artefacto de review/report da atual
- Sempre preferir mudanças pequenas em parâmetros e heurísticas antes de refactors maiores
- Se aparecer bloqueio conceptual, reportar ao Igor em vez de inventar
