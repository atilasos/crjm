# IMPLEMENTATION ORCHESTRATION — CRJM

Data: 2026-03-18
Repo: `~/dev/crjm`
Status: Plano unificado + arranque de implementação

## 1) Objetivo
Passar de planeamento para execução integrada de IA + UI + Pedagogia + Avaliação, com risco controlado e entregas curtas no repositório.

## 2) Decisões fechadas

### 2.1 Contrato transversal obrigatório
A base comum de integração é o `AIResponse v1` (pedido/resposta + explicabilidade + observabilidade técnica).

### 2.2 Jogo piloto oficial
**Piloto escolhido: Dominório**.

Justificação curta:
1. Motor mais estável hoje (TS forte + WASM + opening book + bitboard).
2. Menor risco para validar rápido o pipeline completo (motor -> UI tutor -> revisão).
3. Permite testar explicabilidade pedagógica relevante (paridade, corredores, finais) já no 1.º/2.º ciclo.

### 2.3 Estratégia de rollout
1. Primeiro interoperabilidade e contrato comum.
2. Depois integração ponta-a-ponta no piloto.
3. Só depois otimização por família algorítmica e expansão aos restantes jogos.

## 3) Arquitetura de execução

### 3.1 Camada comum (`src/ai-core/`)
- `types.ts`: `AIRequestV1`, `AIResponseV1`, envelopes worker, tipos de explicação.
- `difficulty.ts`: normalização `level 1..5` em parâmetros técnicos/pedagógicos.
- `index.ts`: exports públicos da camada.

### 3.2 Adaptadores por jogo
Cada jogo mantém o motor atual e ganha adaptador incremental para mapear protocolo atual -> V1.

### 3.3 Contrato UI/Tutor
UI consome apenas V1 para:
- `bestMove`, `topMoves`, `criticalThreats`, `explainText`.
- `turningPoints` no pós-jogo.
- `stats` para observabilidade e avaliação.

## 4) Backlog imediato (ordem de execução)

1. **F0.1 - Foundation types (P0)**
Entrega:
- `src/ai-core/types.ts`
- `src/ai-core/difficulty.ts`
- `src/ai-core/index.ts`
Critério:
- build sem regressão
- contrato V1 importável por qualquer jogo

2. **F0.2 - Especificação operacional do V1 (P0)**
Entrega:
- `docs/agents/AIResponse-v1.md`
- tabela de campos obrigatórios/opcionais + fallback rules
Critério:
- acordo IA + UI + Pedagogia + Avaliação sobre campos mínimos do MVP

3. **F1.1 - Adaptador Dominório para V1 (P1)**
Entrega:
- `src/games/dominorio/ai/v1-adapter.ts`
- mapping request/response antigo -> V1
Critério:
- decisão de jogada funcional
- `explainText`, `topMoves` e `stats` presentes no payload

4. **F1.2 - UI tutor mínima no Dominório (P1)**
Entrega:
- `TutorHintCard` + `TopMovesRail` + ameaça crítica mínima
Critério:
- durante jogo: 1 insight + 1 ação sugerida
- pós-jogo: 1 turning point visível

5. **F1.3 - Pedagogia MVP Dominório (P1)**
Entrega:
- taxonomia inicial: `E-DO-01`, `E-DO-02`, `E-DO-03`
- hints H1-H3 com regra de subida/descida
Critério:
- feedback curto (1-2 frases)
- revisão pós-jogo executável em <= 4 min

6. **F1.4 - Avaliação baseline do piloto (P1)**
Entrega:
- harness AI vs AI (níveis)
- relatório inicial técnico/pedagógico do Dominório
Critério:
- métricas T1-T4 e checks pedagógicos P1/P5/P6/P7 instrumentados

7. **F2 - Segundo jogo (família diferente) (P2)**
Entrega:
- Atari Go integrado no pipeline V1
Critério:
- 2 jogos com fluxo tutor mínimo funcional

## 5) Gates de passagem

### Gate A (fim Fase 0)
- `ai-core` estável no repo
- `AIResponse-v1.md` aprovado
- sem regressão no build

### Gate B (fim Fase 1)
- Dominório ponta-a-ponta: motor -> UI -> revisão
- baseline técnico/pedagógico recolhido

### Gate C (fim Fase 2)
- segundo jogo integrado (Atari Go)
- pipeline transversal validado em duas famílias

## 6) Riscos e mitigação
1. **WASM indisponível em ambiente local/build**
Mitigação: fallback TS obrigatório e monitorizado por `stats.usedWasm`.

2. **Heterogeneidade de protocolos legados**
Mitigação: adaptadores por jogo, sem refatoração big-bang.

3. **Sobrecarga cognitiva no tutor**
Mitigação: regra UI fixa do MVP: 1 insight + 1 ação, no máximo 3 top moves.

4. **Regressão silenciosa de dificuldade**
Mitigação: baseline com ladder N1..N5 e checkpoints T1-T4/B1-B4.

## 7) Estado atual desta execução
- Plano unificado consolidado neste documento.
- Piloto oficial decidido: Dominório.
- Fase 0 iniciada no código com `src/ai-core/` (tipos + dificuldade + exports).
