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
**Status:** 🔧 ATIVA (bloqueada) — FAIL no gate final de 2026-03-21
- Plano ativo: `docs/agents/plans/f4-cirurgia-gate-fix.md`
- Review do gate final: `docs/agents/reviews/f4-phase-c-fail-2026-03-21.md`
- Bloqueios atuais: Dominório falha T1 em `N2>N1` e `N5>N4`; B1 falha em pares críticos de Dominório e Atari Go.

### F5 — Classroom-ready gate 🔒
**Status:** ⏸️ PENDENTE (aguarda fecho da F4)
**Objetivo:** definir e validar critérios formais para teste com alunos reais (Piloto).
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
