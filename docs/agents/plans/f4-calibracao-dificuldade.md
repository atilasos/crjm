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

## Fecho F4.2 (executado)

#### F4.2.4 — Atari Go nC3: reduzir instabilidade do nível 3 (p95 > 3*p50)
**Status (evidência já em `main`):** concluída — commit `d95f6be`, review `docs/agents/reviews/f4-2-4-atarigo-nc3-ajuste.md`.

**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-2-4-atarigo-nc3-ajuste.md`

**Checks:**
- [x] Ajuste mínimo para o nível 3 cumprir `p95 <= 3*p50` em `nC3`
- [x] Preservar `nC2Pass=true` e compatibilidade do shape de `baseline.json`
- [x] Teste do ladder atualizado e a passar

**Artefacto esperado:**
- [x] Review curto com before/after (`p50`, `p95`, razão `p95/p50`) e decisão de continuar para novo gate final

---

## Próximo trabalho executável (uma unidade)

#### F4.2.5 — Reexecutar gate final F4 (hardening consolidado)
**Status (evidência já em `main`):** executada com **FAIL** no gate F4 — commit `277464d`, review `docs/agents/reviews/f4-final-review.md`.

**Files:**
- Run: `scripts/hardening-f3_2.ts` (ou sucessor)
- Write/update: `docs/agents/reviews/f4-final-review.md`

**Checks:**
- [x] Executar benchmark/hardening consolidado com baseline atualizado pós-F4.2.4
- [x] Revalidar critérios de pronto da F4 (T1 e T4) com decisão explícita PASS/FAIL
- [ ] Se PASS: marcar F4 como concluída no roadmap (não aplicável neste ciclo)
- [x] Se FAIL: abrir sub-bloco seguinte com causa específica e próxima unidade mínima

**Artefacto esperado:**
- [x] Review final atualizado com evidência do gate e decisão de progressão

#### F4.2.6 — Reabrir ajuste mínimo de ladder (foco no primeiro par em regressão `N3>N2`)
**Status (evidência já em `main`):** concluída — commit `b937338`, review `docs/agents/reviews/f4-2-6-atarigo-reajuste.md`.

**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-2-6-atarigo-reajuste.md`

**Checks:**
- [x] Ajustar separação do ladder com mudança mínima focada em `N3>N2`
- [x] Revalidar `nC2Pass` e `nC3Pass` após o ajuste
- [x] Produzir decisão explícita para novo gate final F4

**Artefacto esperado:**
- [x] Review curto com before/after de `N3>N2`, `nC2Pass`, `nC3Pass` e decisão para novo gate final

#### F4.2.7 — Corrigir regressão em `N2>N1` sem perder `N3>N2`
**Status (evidência já em `main`):** concluída — commit `bd48a88`, review `docs/agents/reviews/f4-2-7-atarigo-n2n1-fix.md`.

**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-2-7-atarigo-n2n1-fix.md`

**Checks:**
- [x] Ajustar separação do ladder com mudança mínima focada em recuperar `N2>N1`
- [x] Preservar `N3>N2 >= 0.60` após o ajuste
- [x] Revalidar `nC2Pass` e `nC3Pass` após o ajuste
- [x] Produzir decisão explícita para novo gate final F4

**Artefacto esperado:**
- [x] Review curto com before/after de `N2>N1`, `N3>N2`, `nC2Pass`, `nC3Pass` e decisão para novo gate final

#### F4.2.8 — Corrigir `nC3Pass=false` remanescente no nível 4 preservando `N2>N1` e `N3>N2`
**Status (evidência já em `main`):** concluída — commit `caaae81`, review `docs/agents/reviews/f4-2-8-atarigo-nc3-l4-fix.md`.

**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-2-8-atarigo-nc3-l4-fix.md`

**Checks:**
- [x] Ajustar separação do ladder com mudança mínima focada no nível 4 para fechar `nC3Pass=false`
- [x] Preservar `N2>N1 >= 0.60` após o ajuste
- [x] Preservar `N3>N2 >= 0.60` após o ajuste
- [x] Revalidar `nC2Pass` e `nC3Pass` após o ajuste
- [x] Produzir decisão explícita para novo gate final F4

**Artefacto esperado:**
- [x] Review curto com before/after de `N2>N1`, `N3>N2`, `nC2Pass`, `nC3Pass` e decisão para novo gate final

#### NEXT-F4.2.9 — Reexecutar gate final F4 (hardening consolidado pós-F4.2.8)
**Status (evidência já em `main`):** concluída — commit `d1c3db4`, review `docs/agents/reviews/f4-final-review.md`, decisão: **FAIL**.

**Files:**
- Run: `scripts/hardening-f3_2.ts` (ou sucessor)
- Write: `docs/agents/reviews/f4-final-review.md`

**Checks:**
- [x] Executar benchmark/hardening consolidado com baseline pós-F4.2.8
- [x] Revalidar critérios de pronto da F4 (T1 e T4) com decisão explícita PASS/FAIL
- [ ] Se PASS: marcar F4 como concluída no roadmap (não aplicável neste ciclo)
- [x] Se FAIL: manter F4 ativa e abrir próxima unidade mínima com foco no gap remanescente

**Artefacto esperado:**
- [x] Review atualizado do gate final F4 com evidência consolidada e decisão PASS/FAIL

#### NEXT-F4.2.10 — Tornar o gate final menos ruidoso e reexecutar hardening F4
**Files:**
- Modify: `scripts/hardening-f3_2.ts` (ou sucessor)
- Run: `bun run hardening:f3.2`
- Write/update: `docs/agents/reviews/f4-final-review.md`

**Checks:**
- [ ] Ajustar parâmetros do gate para reduzir ruído (`gamesPerMirror=2`, `maxPliesPerGame=48`) mantendo execução viável
- [ ] Reexecutar gate final F4 com parâmetros atualizados
- [ ] Revalidar critérios F4 (T1/T4) e nC2/nC3 com decisão explícita PASS/FAIL
- [ ] Se PASS: marcar F4 como concluída no roadmap
- [ ] Se FAIL: manter F4 ativa e abrir próxima unidade mínima estritamente focada no gap remanescente

**Artefacto esperado:**
- [ ] Review final F4 atualizado com before/after dos parâmetros do gate e decisão de progressão

### F4.1 (executada) — Recalibração Dominório para fechar T1/T4

#### F4.1.1 — Reauditar baseline atual e definir alvo mínimo por par
**Status (evidência já em `main`):** concluída — commit `7c5a0ee`, review `docs/agents/reviews/f4-1-1-dominorio-reauditoria.md`.

**Files:**
- Read: `artifacts/dominorio-baseline/latest/baseline.md`
- Read: `docs/reports/dominorio/F4-calibracao-report.md`
- Write: `docs/agents/reviews/f4-1-1-dominorio-reauditoria.md`

**Checks:**
- [x] Listar pares T1 em FAIL com delta para 60%
- [x] Listar valor atual de T4 e gap para <=15%
- [x] Definir hipótese única de ajuste para T1/T4 (sem refactor)

**Artefacto esperado:**
- [x] Review curto com hipótese prioritária e critério de aceitação mensurável

#### F4.1.2 — Separar N4/N5 com ajuste mínimo e reduzir variância de topo
**Status (evidência já em `main`):** concluída — commit `402b6dc`, review `docs/agents/reviews/f4-1-2-dominorio-ajuste.md`.

**Files:**
- Modify: `src/games/dominorio/ai/types.ts`
- Modify: `src/games/dominorio/ai/v1-adapter.ts`
- Test: `src/games/dominorio/ai/*.test.ts`

**Checks:**
- [x] N4 e N5 deixam de partilhar preset efetivo no runtime
- [x] Política de abertura/seleção para N4/N5 reduz aleatoriedade não necessária
- [x] Testes Dominório relevantes passam

**Artefacto esperado:**
- [x] Commit com diff mínimo + nota de racional em mensagem de commit

#### F4.1.3 — Regenerar baseline Dominório e validar gate local F4.1
**Status (evidência já em `main`):** concluída — commit `d1f0e72`, report `docs/reports/dominorio/F4-1-dominorio-recalibracao-report.md`, decisão local: **FAIL**.

**Files:**
- Run: `bun run baseline:dominorio`
- Write/update: `artifacts/dominorio-baseline/latest/*`
- Write: `docs/reports/dominorio/F4-1-dominorio-recalibracao-report.md`

**Checks:**
- [x] Recalcular T1 por pares (`N2>N1`, `N3>N2`, `N4>N3`, `N5>N4`)
- [x] Recalcular T4 (divergência)
- [x] Decidir PASS/FAIL de F4.1 com evidência explícita

**Artefacto esperado:**
- [x] Report com tabela antes/depois e decisão de continuação

### F4.2 (ativa) — Recalibração Atari Go ladder

#### F4.2.1 — Reauditar ladder atual e fixar objetivo N-C2/N-C3 por nível
**Status (evidência já em `main`):** concluída — commit `4b8455f`, review `docs/agents/reviews/f4-2-1-atarigo-reauditoria.md`.

**Files:**
- Read: `artifacts/atari-go-baseline/latest/baseline.json`
- Read: `scripts/atari-go-ladder-baseline.ts`
- Write: `docs/agents/reviews/f4-2-1-atarigo-reauditoria.md`

**Checks:**
- [x] Identificar pares/níveis que causam `nC2Pass=false`
- [x] Identificar níveis fora de budget que causam `nC3Pass=false`
- [x] Definir ajuste mínimo prioritário para ladder

**Artefacto esperado:**
- [x] Review com matriz FAIL atual + alvo concreto por métrica

#### F4.2.2 — Ajustar ladder com mudança mínima em separação média
**Status (evidência já em `main`):** concluída — commit `30fc75c`, review `docs/agents/reviews/f4-2-2-atarigo-ajuste.md`.

**Files:**
- Modify: `scripts/atari-go-ladder-baseline.ts`
- Test: `scripts/atari-go-ladder-baseline.test.ts`
- Write: `docs/agents/reviews/f4-2-2-atarigo-ajuste.md`

**Checks:**
- [x] Melhorar separação N-C2 (foco N2/N3) sem alterar contrato de output
- [x] Manter shape de `baseline.json` compatível com hardening
- [x] Teste do ladder passa

**Artefacto esperado:**
- [x] Review com racional do ajuste e impacto esperado em N-C2/N-C3

#### F4.2.3 — Regenerar baseline Atari Go e decidir desbloqueio F4
**Status (evidência já em `main`):** concluída — commit `16303c7`, report `docs/reports/atari-go/F4-2-ladder-recalibracao-report.md`, decisão: iterar F4.2 (`nC3Pass=false` no nível 3).

**Files:**
- Run: `bun run baseline:atari-go`
- Write/update: `artifacts/atari-go-baseline/latest/baseline.json`
- Write: `docs/reports/atari-go/F4-2-ladder-recalibracao-report.md`

**Checks:**
- [x] Validar `nC2Pass` e `nC3Pass` no snapshot pós-ajuste
- [x] Confirmar tendência T1 ladder >=60% nos pares definidos
- [x] Registar se F4 fica pronta para novo gate final

**Artefacto esperado:**
- [x] Report com decisão: voltar a Task 5 (hardening final) ou iterar F4.2

---

## Regras de execução
- Uma task por execução do cron
- Não avançar para a próxima task sem artefacto de review/report da atual
- Sempre preferir mudanças pequenas em parâmetros e heurísticas antes de refactors maiores
- Se aparecer bloqueio conceptual, reportar ao Igor em vez de inventar
