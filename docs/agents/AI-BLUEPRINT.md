# AI Blueprint (CRJM)

Data: 2026-03-18
Papel: Especialista IA (motor/algoritmos)

## 1) Diagnóstico da estrutura atual

### 1.1 Organização por jogo
A estrutura em `src/games/{jogo}` está consistente com o padrão `logic.ts` + `types.ts` + `UI` + `ai/`.

Jogos com `ai/` e worker dedicado:
- `dominorio`
- `quelhas`
- `produto`
- `atari-go`
- `nex`
- `gatos-caes` (tem worker/engine, mas cliente usa computação inline)

### 1.2 Estado atual dos motores

- `Dominório`
  - TS: negamax/alpha-beta + iterative deepening + opening book (`book.json`) + bitboard.
  - WASM (`wasm/dominorio_ai`): engine robusto com TT/Zobrist.
  - Nota: `ai-client.ts` atual usa implementação inline TS (comentário refere limitação do Bun dev server).

- `Quelhas` (misère)
  - TS: engine dedicado com pruning/candidatos dinâmicos e avaliação misère.
  - WASM (`wasm/quelhas` workspace): bridge `quelhas-wasm` + crates core/ai.
  - Worker mantém fallback TS se WASM falhar.

- `Produto`
  - Worker orientado a WASM (`wasm/produto_ai`), com fallback aleatório mínimo.
  - WASM expõe `choose_move` com config de dificuldade e pista textual (`explain_last`).

- `Atari Go`
  - Worker orientado a WASM (`wasm/atari_go_ai`) com stats.
  - Fallback TS usa `jogadaComputador` do `logic.ts` (sem paridade de força com WASM).

- `Nex`
  - Worker orientado a WASM (`wasm/nex_ai`).
  - Fallback atual devolve `null` (não há motor TS equivalente competitivo).

- `Gatos & Cães`
  - TS engine forte (negamax/alpha-beta/TT/killer/history) em `engine.ts`.
  - Cliente atual inline (`computeMove`) sem worker ativo, apesar de existir `gatos-caes.worker.ts`.
  - Não existe crate WASM dedicada para este jogo no estado atual.

### 1.3 Build e pipeline WASM/worker

- `build.ts` já compila WASM para: Dominório, Quelhas, Produto, Atari Go, Nex.
- Também empacota workers para `dist/ai/{jogo}` e copia `wasm/pkg` para caminhos esperados.
- Estratégia atual de runtime: cada jogo tem protocolo próprio (`AIRequest/AIResponse`) e métricas distintas.

### 1.4 Gap principal identificado

Existe capacidade técnica por jogo, mas falta **camada comum de contrato de IA**:
- APIs e tipos heterogéneos por jogo.
- Dificuldade não uniforme (níveis por nome, por número, e sem política contínua transversal).
- Explicabilidade inconsistente (`explain` só em alguns jogos).
- Fallbacks com qualidade muito desigual (de robusto em Dominório/Quelhas até `null`/aleatório em Nex/Produto).

---

## 2) Blueprint técnico inicial

## 2.1 Interface comum (Core Contract)

Objetivo: unificar integração UI/IA sem perder especialização por jogo.

```ts
export type GameId =
  | 'gatos-caes'
  | 'dominorio'
  | 'quelhas'
  | 'produto'
  | 'atari-go'
  | 'nex';

export interface IGameAdapter<State, Move> {
  gameId: GameId;
  clone(state: State): State;
  currentPlayer(state: State): 1 | 2;
  legalMoves(state: State): Move[];
  applyMove(state: State, move: Move): State;
  isTerminal(state: State): boolean;
  terminalValue(state: State, pov: 1 | 2): number; // [-1, 0, +1] ou score normalizado
}

export interface AIExplain {
  summary: string;                  // frase curta para UI
  principalVariation?: unknown[];   // linha principal em formato do jogo
  topMoves?: Array<{ move: unknown; score: number; confidence?: number }>;
  threats?: string[];
}

export interface AIRequestV1<State> {
  gameId: GameId;
  requestId: number;
  state: State;
  level: number; // 1..5 (normalizado)
  timeBudgetMs?: number;
  seed?: number;
  mode?: 'competitive' | 'tutor';
}

export interface AIResultV1<Move> {
  type: 'result';
  requestId: number;
  move: Move | null;
  score?: number;
  stats: {
    elapsedMs: number;
    nodes?: number;
    depth?: number;
    simulations?: number;
    ttHits?: number;
    ttProbes?: number;
    usedWasm: boolean;
  };
  explain?: AIExplain;
}
```

Decisão prática:
- Manter os motores atuais por jogo.
- Introduzir **adaptadores por jogo** para mapear protocolo atual -> `AIRequestV1/AIResultV1`.
- Evitar big-bang refactor; migrar UI jogo a jogo.

## 2.2 Famílias de algoritmo por jogo

- Família A (busca clássica determinística):
  - `Dominório`, `Quelhas`, `Gatos & Cães`
  - Base: Negamax/PVS + Alpha-Beta + Iterative Deepening + TT/Zobrist + ordering.
  - Motivo: jogos de bloqueio/partilha de espaço com boa resposta a poda e avaliação estrutural.

- Família B (MCTS/UCT + endgame solver):
  - `Produto`, `Atari Go`, `Nex`
  - Base: MCTS (UCT) para midgame; troca para minimax/alpha-beta quando vazio <= limiar.
  - Motivo: branching alto + valor de simulações guiadas por heurística.

## 2.3 Heurísticas prioritárias por jogo

- `Dominório`
  - Mobilidade relativa (`myMoves - oppMoves`)
  - Paridade de regiões
  - Controlo de cortes e corredores
  - Opening book curto (já existente)

- `Quelhas` (misère)
  - Paridade de runs
  - Criação/evitação de ilhas isoladas
  - Jogadas que forçam último lance no adversário

- `Gatos & Cães`
  - Mobilidade e contra-mobilidade
  - Controlo de centro no opening
  - Penalização de auto-bloqueio

- `Produto`
  - Ganho marginal no produto de grupos
  - Valor de ponte/conexão entre grupos
  - Risco de fusão favorável ao adversário

- `Atari Go`
  - Captura imediata (prioridade máxima)
  - Salvamento de grupos em atari
  - Redução de liberdades adversárias

- `Nex`
  - Distância para conexão entre lados
  - Conexões virtuais
  - Ameaças duplas (dual-threat)

## 2.4 Política de dificuldade contínua (1..5)

Parâmetros comuns por nível:
- `timeBudgetMs`
- `searchIntensity` (depth alvo ou nº simulações)
- `noise` (epsilon-greedy / top-k randomizado)
- `heuristicMix` (peso de rollout guiado)

Preset inicial transversal:
- N1: rápido, alta aleatoriedade controlada
- N2: mais estável, ainda exploratório
- N3: baseline competitivo
- N4: baixa aleatoriedade, mais profundidade
- N5: máximo orçamento + seleção quase determinística

---

## 3) Sequência de implementação (work packages)

## Fase 0 - Contrato comum (curto prazo)
1. Criar `src/ai-core/types.ts` com `IGameAdapter` + `AIRequestV1` + `AIResultV1`.
2. Criar `src/ai-core/difficulty.ts` com normalização `level -> parâmetros`.
3. Adaptar 1 jogo piloto (recomendado: `dominorio`) para usar o contrato V1 sem quebrar UI.

## Fase 1 - Uniformizar integração worker
1. Definir envelope comum de mensagens (`ready/result/error/cancel`).
2. Aplicar adaptador nos restantes jogos mantendo motores atuais.
3. Garantir fallback mínimo funcional em todos os jogos (evitar `null` sistemático).

## Fase 2 - Heurísticas e força por família
1. Família A: tuning de avaliação e ordering (Dominório/Quelhas/Gatos).
2. Família B: estabilizar MCTS + rollout policy + trigger de endgame solver.
3. Benchmarks locais por jogo (tempo, winrate, estabilidade entre seeds).

## Fase 3 - Modo tutor (integração pedagógica)
1. Popular `AIExplain` em todos os jogos (resumo + top moves + ameaça crítica).
2. Exportar turning points por partida para revisão pós-jogo.
3. Ligar saída ao fluxo pedagógico sem alterar motor competitivo.

---

## 4) Notas de integração no repo atual

- Criar pasta nova `src/ai-core/` (transversal, sem dependência de jogo específico).
- `docs/agents/` passa a concentrar estratégia dos agentes (este ficheiro é baseline).
- Não remover protocolos atuais de imediato; usar camada de compatibilidade.
- Garantir que `build.ts` continua a copiar workers/WASM sem mudança de paths.
- Prioridade técnica imediata:
  - ativar fallback TS útil para `nex` e `produto` quando WASM indisponível;
  - considerar migrar `gatos-caes` para worker para evitar bloqueio em dispositivos fracos.

---

## 5) Critérios de aceite do blueprint

- Existe contrato comum V1 documentado e versionável.
- Cada jogo está mapeado explicitamente a uma família algorítmica.
- Heurísticas prioritárias por jogo estão definidas e ordenadas.
- Sequência de implementação é incremental e compatível com o estado atual.
- Integração prevista sem regressão no build atual (Bun + workers + WASM).
