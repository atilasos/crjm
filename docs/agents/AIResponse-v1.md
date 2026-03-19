# AIResponse v1 — Especificação Operacional

Versão: 1.0 (draft operacional)
Data: 2026-03-18

## 1) Objetivo
Definir contrato único para pedido/resposta de IA entre motores, workers e UI tutor.

## 2) Campos mínimos obrigatórios

### Request (`AIRequestV1`)
- `version`
- `requestId`
- `gameId`
- `mode`
- `level`
- `state`

### Response (`AIResponseV1`)
- `version`
- `requestId`
- `gameId`
- `mode`
- `bestMove`
- `topMoves` (0..3)
- `explainText`
- `stats.elapsedMs`
- `stats.usedWasm`
- `stats.engine`

## 3) Campos recomendados MVP
- `principalVariation`
- `criticalThreats` (0..2 in-game)
- `confidence` (0..1)
- `turningPoints` (0..3 no pós-jogo)
- `stats.depth`, `stats.nodes`, `stats.simulations`

## 4) Regras de fallback
1. Se falhar cálculo de explicação, preencher `explainText` com mensagem curta neutra.
2. Se não existir ameaça crítica, enviar `criticalThreats: []`.
3. Se `bestMove` for `null`, manter resposta válida com `topMoves: []`.
4. Se WASM indisponível, continuar com fallback TS e `stats.usedWasm=false`.

## 5) Limites de UX do contrato
1. `topMoves` máximo 3.
2. `explainText` até 160 caracteres (ideal: 1-2 frases).
3. `turningPoints` máximo 3 no MVP.
4. `criticalThreats` máximo 2 durante a partida.

## 6) Compatibilidade incremental
- Motores atuais não são reescritos nesta fase.
- Cada jogo implementa adaptador para mapear protocolo legado -> V1.
