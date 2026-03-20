# ROADMAP CRJM — Visão Macro

Data: 2026-03-20
Repo: `~/dev/crjm`

## Objetivo final
Sistema de jogos matemáticos com IA progressiva e instrutora, pronto para uso em sala de aula com crianças de 4–10 anos.

## Fases concluídas

### F0 — Foundation transversal ✅
- `src/ai-core/` com tipos, dificuldade e contrato `AIResponse v1`
- `docs/agents/AIResponse-v1.md`

### F1 — Piloto Dominório ✅
- F1.1: adaptador V1
- F1.2: UI tutor mínima (TutorHintCard, TopMovesRail, ameaça crítica)
- F1.3: pedagogia MVP (taxonomia, hints H1–H3, revisão pós-jogo leve)
- F1.4: baseline AI vs AI

### F2 — Segundo jogo (Atari Go) ✅
- Adaptador V1, UI tutor, testes de integração

### F3 — Hardening inicial ✅
- F3.1: harness cross-game, checklist N1–N5
- F3.2: ladder Atari Go, atualização de protocolo

## Fases ativas

### F4 — Calibração de dificuldade e estabilidade 🔧
**Objetivo:** a escada N1–N5 deve ser claramente observável nos benchmarks.
**Plano:** `docs/agents/plans/f4-calibracao-dificuldade.md`
**Critério de saída:**
- T1 (nível N vs N-1 win rate >= 60%) PASS em todos os pares para Dominório e Atari Go
- T4 (estabilidade/repetibilidade) <= 15% divergência
- Baseline atualizado e publicado

**Estado atual (2026-03-20):**
- Task 1 concluída (`7be4388`, review `docs/agents/reviews/f4-01-auditoria-parametros.md`)
- Task 2 concluída (`841b0e7`, `a7fc773`)
- Task 3 concluída (`1807dfc`, `673d8f0`, report `docs/reports/dominorio/F4-calibracao-report.md`)
- Task 4 concluída (`5781003`, review `docs/agents/reviews/f4-04-atarigo-ajuste.md`)
- Task 5 executada com **FAIL** no gate (`277464d`, review `docs/agents/reviews/f4-final-review.md`)
- F4.1.1 concluída (`7c5a0ee`, review `docs/agents/reviews/f4-1-1-dominorio-reauditoria.md`)
- F4.1.2 concluída (`402b6dc`, review `docs/agents/reviews/f4-1-2-dominorio-ajuste.md`)
- F4.1.3 concluída (`d1f0e72`, report `docs/reports/dominorio/F4-1-dominorio-recalibracao-report.md`, decisão local: FAIL)
- F4.2.1 concluída (`4b8455f`, review `docs/agents/reviews/f4-2-1-atarigo-reauditoria.md`)
- F4.2.2 concluída (`30fc75c`, review `docs/agents/reviews/f4-2-2-atarigo-ajuste.md`)
- F4.2.3 concluída (`16303c7`, report `docs/reports/atari-go/F4-2-ladder-recalibracao-report.md`, `nC2Pass=true`, `nC3Pass=false` no nível 3)
- F4.2.4 concluída (`d95f6be`, review `docs/agents/reviews/f4-2-4-atarigo-nc3-ajuste.md`, `nC2Pass=true`, `nC3Pass=true`)
- F4.2.5 executada (hardening consolidado em `2026-03-20T11:16:49Z`, review `docs/agents/reviews/f4-final-review.md`), decisão do gate F4: **FAIL**
- F4.2.6 concluída (`b937338`, review `docs/agents/reviews/f4-2-6-atarigo-reajuste.md`, objetivo `N3>N2` atingido)
- F4.2.7 concluída (`bd48a88`, review `docs/agents/reviews/f4-2-7-atarigo-n2n1-fix.md`, objetivo `N2>N1` recuperado)
- F4.2.8 concluída (`caaae81`, review `docs/agents/reviews/f4-2-8-atarigo-nc3-l4-fix.md`, objetivo `nC3Pass` no nível 4 recuperado preservando `N2>N1` e `N3>N2`)

**Progressão de sub-blocos (F4 permanece ativa):**
- **F4.1 (executada até F4.1.3):** concluída com gate local **FAIL**; sem tarefa nova aberta neste ciclo.
- **F4.2 (ativa):** após F4.2.8, os ajustes de ladder foram concluídos; próximo passo é revalidar o gate final F4.
  - próxima unidade executável: `NEXT-F4.2.9` (reexecutar gate final F4 com hardening consolidado e baseline pós-F4.2.8)
  - files: `scripts/hardening-f3_2.ts` (ou sucessor) + `docs/agents/reviews/f4-final-review.md`
  - artifact: review atualizado com decisão explícita PASS/FAIL do gate final F4

### F5 — Classroom-ready gate 🔒
**Objetivo:** definir e validar critérios formais para teste com alunos reais.
**Plano:** `docs/agents/plans/f5-classroom-gate.md`
**Critério de saída:**
- Checklist técnico + pedagógico aprovado
- 2 jogos com fluxo tutor completo validado
- Revisão pós-jogo consistente
- Documento de aprovação em `docs/agents/reviews/`

### F6 — Expansão aos restantes jogos 📦
**Objetivo:** integrar Quelhas, Produto, Gatos & Cães e Nex no pipeline V1+tutor.
**Plano:** `docs/agents/plans/f6-expansao-jogos.md`
**Critério de saída:**
- 6 jogos com adaptador V1 + UI tutor mínima
- Baseline por jogo
- Checklist pedagógico por jogo

## Fases futuras (não planeadas em detalhe)

### F7 — Adaptação dinâmica ao aluno
- Rolling win rate, DDA, ZPD targeting (40–50% win rate)
- Perfil por aluno (persistência)

### F8 — Camada neural/expert
- ONNX / AlphaZero-style para tier expert
- Avaliação de viabilidade browser-side

### F9 — Modo competição separado
- Sem dicas, sem revisão em tempo real
- Simular condições de torneio CNJM

## Princípios de execução
1. **Plan-driven**: cada fase tem um plano executável em `docs/agents/plans/`
2. **Tarefas pequenas**: 2–10 min cada, ficheiros concretos, verificação explícita
3. **Commits incrementais**: cada unidade lógica = 1 commit + push
4. **Testes antes de push**: se falham, corrigir ou reportar
5. **Reviews em blocos críticos**: dificuldade, pedagogia, classroom-gate
6. **Artefactos em ficheiro**: planos, reports, reviews — tudo versionado
