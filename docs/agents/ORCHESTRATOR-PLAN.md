# ORCHESTRATOR PLAN — CRJM

Data de referência: 2026-03-18 17:28 (GMT+0)  
Repo: `~/dev/crjm`  
Commit base analisada: `72a5206`

## 1) Estado do workspace

### 1.1 Estrutura e cobertura
- Estrutura principal presente e consistente: `src/`, `docs/`, `wasm/`, `scripts/`, `.github/workflows`.
- `src/games/` contém os 6 jogos oficiais com `logic.ts`, `types.ts`, `logic.test.ts`, UI React e camada `ai/` por jogo.
- `src/server/` e `src/tournament/` já suportam torneios com dupla eliminação, admin panel e protocolo WS.

### 1.2 Estado das IAs (arquitetura)
- Arquitetura híbrida em uso: Worker + fallback TS em todos os jogos.
- Crates Rust/WASM existentes para: `dominorio_ai`, `quelhas`, `produto_ai`, `atari_go_ai`, `nex_ai`.
- `gatos-caes` está atualmente apenas em TypeScript (sem crate Rust).
- `build.ts` já tenta compilar WASM para Dominório, Quelhas, Produto, Atari Go e Nex, com fallback explícito para TS.

### 1.3 Estado de outputs e documentação
- Existe documentação técnica por jogo (`docs/QUELHAS-IA.md`, `docs/PRODUTO-IA.md`, `docs/ATARIGO-IA.md`, `docs/NEX-IA.md`) e plano global (`docs/AI-IMPROVEMENT-PLAN.md`).
- Não existia pasta `docs/agents/` no repo; criada agora para consolidação de coordenação.

### 1.4 Riscos imediatos observáveis
- Pacotes `src/games/*/ai/wasm/pkg/` no repo estão com `.gitkeep` (sem artefactos compilados), logo o fluxo depende de toolchain Rust no ambiente de build.
- Divergência potencial entre documentação antiga (stubs em torneio para alguns jogos) e estado atual do código (adapters ativos para os 6 jogos no server).

## 2) Prioridades imediatas (orquestração)

### P0 — Contrato comum de resposta IA (transversal)
Objetivo: alinhar IA, UI e pedagogia numa interface única (`AIResponse v1`) para explicabilidade e integração.
- Campos mínimos recomendados: `bestMove`, `topMoves`, `principalVariation`, `explainText`, `criticalThreats`, `confidence`, `computeMs`.
- Entregáveis: `docs/agents/AIResponse-v1.md` + tipo TS central.

### P1 — Matriz por jogo (algoritmo principal + fallback + heurísticas)
Objetivo: fechar decisão técnica por família de jogo e reduzir ambiguidades de implementação.
- Dominório/Quelhas/Gatos&Cães: busca clássica + heurísticas.
- Produto/Atari Go/Nex: MCTS/PVS/negamax híbrido por fase.
- Entregável: `docs/agents/Matriz_algoritmos_por_jogo.md`.

### P2 — Piloto pedagógico em 1 jogo
Objetivo: validar valor educacional cedo (não apenas força da IA).
- Jogo piloto recomendado: Dominório (estado técnico mais estável) ou Atari Go (feedback tático claro).
- Entregáveis: turning points + revisão pós-jogo + 1 mini-drill por erro típico.

### P3 — Baseline de avaliação e regressão
Objetivo: impedir regressões ao acelerar melhorias de IA.
- Métricas mínimas: winrate por nível, tempo médio de decisão, estabilidade de jogada, cobertura de testes por motor.
- Entregável: `docs/agents/Matriz_avaliacao.md`.

## 3) Dependências entre agentes

## 3.1 Mapa de precedência
1. Orquestrador define `AIResponse v1` e critérios de aceite iniciais.
2. IA e UI validam contrato em conjunto (schema + transporte worker).
3. Pedagogia define taxonomia de erros e templates de explicação em cima do contrato.
4. Avaliação fixa benchmarks e valida qualidade técnica/pedagógica.
5. Orquestrador fecha gate de release por fase.

## 3.2 Dependências práticas por output
- `AIResponse v1` depende de: Orquestrador + IA + UI.
- `Matriz_algoritmos_por_jogo` depende de: IA + validação Orquestrador.
- `Modelo_pedagogico_CRJM` e `Regras_DDA` dependem de: Pedagogia + campos de explicação do `AIResponse`.
- `Matriz_avaliacao` depende de: Avaliação + métricas expostas por IA/UI.

## 4) Ordem recomendada de execução (3 primeiras semanas)

## Semana 1 — Alinhamento e contratos (fundação)
- W1-D1/D2: Consolidar requisitos comuns (WP-O1) e publicar `AIResponse v1` draft.
- W1-D2/D3: Sessão IA+UI para fechar contrato técnico (worker messages, tipos TS, fallback).
- W1-D3/D4: Publicar `Matriz_algoritmos_por_jogo` v1 (decisão por jogo + risco + custo).
- W1-D5: Definir critérios de aceite MVP por camada (IA/UI/Pedagogia/Avaliação).

Gate de saída da semana:
- Contrato `AIResponse v1` congelado.
- Matriz por jogo aprovada.

## Semana 2 — Execução técnica e piloto
- IA: implementar integração do contrato em 1 jogo piloto (Dominório ou Atari Go).
- UI: ligar visualização de `topMoves`, ameaça crítica e explicação curta.
- Pedagogia: criar taxonomia de erros do piloto + 3 templates de feedback.
- Avaliação: baseline de benchmark do piloto (tempo/qualidade/winrate por nível).

Gate de saída da semana:
- Piloto funcional ponta-a-ponta (motor → UI → revisão pós-jogo).
- Métricas baseline recolhidas e documentadas.

## Semana 3 — Escalar para 2º jogo + hardening
- Replicar pipeline do piloto para um segundo jogo da outra família algorítmica.
- IA: afinar dificuldade contínua (iterações + epsilon) e estabilidade de decisão.
- UI/Pedagogia: consolidar fluxo de revisão pós-jogo reutilizável.
- Avaliação: regressão cruzada (piloto 1 vs piloto 2) e checklist de aceite.

Gate de saída da semana:
- 2 jogos com fluxo tutor básico funcional.
- Plano de expansão para os 4 jogos restantes com estimativas.

## 5) Sequência recomendada de work packages (início)
1. WP-O1 (Orquestrador) — Requisitos comuns + `AIResponse v1`.
2. WP-IA1 + WP-UI1 (IA/UI) — Contrato motor→UI implementável.
3. WP-O2 (Orquestrador) — Matriz de algoritmos por jogo.
4. WP-IA2/WP-IA3 (IA) — Base de motor no jogo piloto.
5. WP-P1/WP-P3/WP-P4 (Pedagogia) — Tutor mínimo + taxonomia de erros.
6. WP-E1/WP-E2/WP-E3 (Avaliação) — Benchmark + regressão inicial.

## 6) Decisões operacionais já tomadas
- Priorizar primeiro interoperabilidade (`AIResponse v1`) e só depois otimização profunda por motor.
- Executar em pilotos curtos por jogo/família algorítmica para reduzir risco de over-engineering.
- Tratar explicabilidade pedagógica como requisito de release, não como melhoria opcional.
- Manter fallback TS sempre funcional enquanto a pipeline WASM não estiver totalmente estabilizada no ambiente de build.
