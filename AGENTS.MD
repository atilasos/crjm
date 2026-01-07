# Agentes e IAs (CRJM)

Este documento descreve as arquiteturas, tecnologias e estratégias utilizadas nas IAs do projeto **Jogos Matemáticos - CRJM**.

## Arquitetura Geral

As IAs seguem uma arquitetura de três camadas com fallback gracioso:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Thread (React)                     │
│                         ↕                                │
│              postMessage / onmessage                     │
│                         ↕                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │               Web Worker (Dedicado)                 │ │
│  │  ┌────────────────────────────────────────────┐    │ │
│  │  │  Rust/WASM Engine  ←──fallback──→  TS Engine │  │ │
│  │  └────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

1. **Rust/WASM Engine**: Motor de alta performance compilado para WebAssembly
2. **TypeScript Fallback**: Implementação JS pura quando WASM não está disponível
3. **Web Worker**: Isolamento do thread principal para UI responsiva
4. **Mensagens Compactas**: Movimentos codificados em inteiros para transferência eficiente

### Estrutura de Ficheiros por Jogo

```
src/games/{jogo}/
├── logic.ts           # Regras do jogo e gestão de estado
├── types.ts           # Tipos TypeScript específicos
├── logic.test.ts      # Testes unitários
├── {Jogo}Game.tsx     # Componente React UI
└── ai/
    ├── ai-client.ts        # Interface e fallback TS
    ├── types.ts            # Tipos da IA
    ├── {jogo}.worker.ts    # Entry point do Worker
    └── wasm/pkg/           # Bindings WASM gerados (produção)

wasm/{jogo}_ai/
├── Cargo.toml         # Configuração Rust
└── src/
    └── lib.rs         # Motor de IA em Rust
```

---

## Detalhes por Jogo

### Gatos & Cães (1.º Ciclo)

| Propriedade | Valor |
|-------------|-------|
| Algoritmo | Minimax com heurísticas de posicionamento |
| Tecnologia | TypeScript puro |
| Tabuleiro | 6×6 (36 células) |
| Dificuldade | Níveis 1-3 |

**Heurísticas principais:**
- Controlo do centro do tabuleiro
- Mobilidade (número de movimentos válidos)
- Padrões de bloqueio

---

### Dominório (1.º, 2.º Ciclo)

| Propriedade | Valor |
|-------------|-------|
| Algoritmo | Alpha-Beta com Transposition Table |
| Tecnologia | Rust/WASM + TS fallback |
| Tabuleiro | 8×8 (64 células) com bitboard |
| Dificuldade | Níveis 1-5 |

**Características técnicas:**
- **Bitboard**: Representação em dois inteiros de 64 bits (horizontal/vertical)
- **Zobrist Hashing**: Para detecção de estados repetidos
- **Opening Book**: Livro de aberturas em JSON (`ai/book.json`)
- **Avaliação**: Espaço disponível e paridade de peças

**Localização do código:**
- Rust: `wasm/dominorio_ai/src/lib.rs`
- TypeScript: `src/games/dominorio/ai/ai-client.ts`
- Bitboard: `src/games/dominorio/ai/bitboard.ts`

---

### Quelhas (1.º, 2.º, 3.º Ciclo) - MISÈRE

| Propriedade | Valor |
|-------------|-------|
| Algoritmo | PVS (Principal Variation Search) + Alpha-Beta |
| Tecnologia | Rust/WASM + TS fallback |
| Tabuleiro | 10×10 (100 células) |
| Modo | **Misère** (quem faz última jogada PERDE) |
| Dificuldade | Níveis 1-5 |

**Características técnicas:**
- **Island Solver (PNS)**: Resolve regiões isoladas independentemente
- **Bitboard**: Dois inteiros de 64 bits para representar 100 células
- **Move Encoding**: `start | (len << 7) | (orient << 11)`
- **Run Analysis**: Detecção de correntes para controlo de paridade

**Avaliação misère:**
- Paridade de "runs" (correntes de células)
- Controlo de regiões isoladas
- Forçar oponente a jogar última peça

**Localização do código:**
- Rust: `wasm/quelhas/` (workspace com 3 crates)
- TypeScript: `src/games/quelhas/ai/engine.ts`

---

### Produto (2.º, 3.º Ciclo, Secundário)

| Propriedade | Valor |
|-------------|-------|
| Algoritmo | MCTS (Monte Carlo Tree Search) + UCT |
| Tecnologia | Rust/WASM + TS fallback |
| Tabuleiro | Hexagonal 61 células (pirâmide 5 lados) |
| Dificuldade | Níveis 1-5 |

**Características técnicas:**
- **MCTS com UCT**: Exploração balanceada com Upper Confidence Bound
- **Minimax Endgame**: Quando restam ≤8 células vazias, muda para minimax completo
- **Packed Move Format**: `{posA, colorA, posB, colorB}`
- **Group Scoring**: Avaliação por produto dos tamanhos de grupos

**Estratégia de branching:**
- Prioridade a peças "ponte" (conectam grupos)
- Adjacências críticas avaliadas primeiro
- Pruning baseado em heurísticas de conexão

**Localização do código:**
- Rust: `wasm/produto_ai/src/lib.rs`
- TypeScript: `src/games/produto/ai/ai-client.ts`

---

### Atari Go (3.º Ciclo, Secundário)

| Propriedade | Valor |
|-------------|-------|
| Algoritmo | PVS com Iterative Deepening |
| Tecnologia | Rust/WASM + TS fallback |
| Tabuleiro | 9×9 (81 células) |
| Objetivo | Capturar qualquer grupo adversário |
| Dificuldade | Níveis 1-5 |

**Características técnicas:**
- **Bitboard 81-bit**: Representação eficiente do tabuleiro Go
- **Liberty Counting**: Contagem rápida de liberdades por grupo
- **Capture Detection**: Identificação imediata de grupos em atari

**Prioridade de movimentos:**
1. Captura imediata de grupos em atari
2. Salvamento de grupos próprios em perigo
3. Extensão de grupos com poucas liberdades
4. Movimentos que reduzem liberdades adversárias

**Localização do código:**
- Rust: `wasm/atari_go_ai/src/lib.rs`
- TypeScript: `src/games/atari-go/ai/ai-client.ts`

---

### Nex (Secundário)

| Propriedade | Valor |
|-------------|-------|
| Algoritmo | Minimax com heurísticas de conexão |
| Tecnologia | Rust/WASM + TS fallback |
| Tabuleiro | Hexagonal (estilo Hex) |
| Objetivo | Conectar lados opostos |
| Dificuldade | Níveis 1-5 |

**Características técnicas:**
- **Hex Grid Graph**: Representação de grafo para pathfinding
- **Connection Heuristics**: Avaliação de proximidade à vitória
- **Virtual Connections**: Detecção de conexões garantidas

**Localização do código:**
- Rust: `wasm/nex_ai/src/lib.rs` (~22KB)
- TypeScript: `src/games/nex/ai/ai-client.ts`

---

## Sistema de Torneios

### Arquitectura do Servidor

```
┌─────────────────────────────────────────────────────────┐
│                  Bun HTTP Server (:4000)                │
├─────────────────────────────────────────────────────────┤
│  /ws          → WebSocket endpoint                      │
│  /admin       → Painel de administração                 │
│  /health      → Health check                            │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│              Tournament Engine                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  Winners    │  │   Losers    │  │  Grand Final   │  │
│  │  Bracket    │  │   Bracket   │  │  + Reset       │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│              Game Adapter (Validação)                   │
│  createInitialState() | applyMove() | isValidMove()    │
│  isGameOver() | getWinner() | getCurrentPlayer()       │
└─────────────────────────────────────────────────────────┘
```

### Ficheiros Principais

| Ficheiro | Linhas | Descrição |
|----------|--------|-----------|
| `tournament-server.ts` | ~700 | Servidor WebSocket e handlers |
| `tournament-engine.ts` | ~450 | Lógica de brackets double-elimination |
| `game-adapter.ts` | ~580 | Interface unificada para todos os jogos |
| `admin-page.ts` | ~1100 | Interface HTML do painel admin |

### Protocolo de Comunicação

**Cliente → Servidor:**
```typescript
type ClientMessage =
  | { type: 'join_tournament', playerId, playerName }
  | { type: 'set_player_ready', playerId }
  | { type: 'submit_move', playerId, matchId, move }
  | { type: 'acknowledge_move', playerId, moveIndex }
  | { type: 'surrender', playerId, matchId }
```

**Servidor → Cliente:**
```typescript
type ServerMessage =
  | { type: 'tournament_state_update', tournament }
  | { type: 'match_assigned', match }
  | { type: 'game_started', gameState }
  | { type: 'move_validated', move, newState }
  | { type: 'game_finished', winner }
  | { type: 'tournament_finished', champion }
```

### Formato de Partida

- **Best of 3**: Melhor de 3 jogos por partida
- **Alternância**: Jogadores alternam quem começa cada jogo
- **Dupla Eliminação**: Perder uma vez → Losers Bracket; perder duas → eliminado
- **Grand Final Reset**: Se vencedor do Losers ganhar, há partida decisiva

### Jogos Suportados em Torneios

| Jogo | Status |
|------|--------|
| Gatos & Cães | ✅ Completo |
| Dominório | ✅ Completo |
| Quelhas | ✅ Completo |
| Produto | 🔧 Stub (não habilitado) |
| Atari Go | 🔧 Stub (não habilitado) |
| Nex | 🔧 Stub (não habilitado) |

---

## Níveis de Dificuldade

Os níveis 1-5 são configurados através de três parâmetros:

| Nível | Tempo (ms) | Profundidade | Heurística |
|-------|------------|--------------|------------|
| 1 | 100 | 2-3 | Básica |
| 2 | 250 | 4-5 | Moderada |
| 3 | 500 | 6-8 | Completa |
| 4 | 1000 | 10-12 | Agressiva |
| 5 | 2000+ | Máxima | Máxima |

---

## Desenvolvimento e Build

### Pré-requisitos

```bash
# Runtime e package manager
bun >= 1.0

# Para builds WASM (opcional)
rustup
cargo
wasm-bindgen-cli
```

### Comandos

```bash
# Desenvolvimento com hot reload
bun run dev

# Build de produção (inclui WASM se toolchain disponível)
bun run build

# Build sem WASM (apenas TypeScript)
bun run build -- --skip-wasm

# Servidor de torneios
bun run tournament

# Testes
bun test
```

### Processo de Build WASM

1. Verifica toolchain Rust (`cargo`, `rustup`)
2. Instala target `wasm32-unknown-unknown` se necessário
3. Instala `wasm-bindgen-cli` se necessário
4. Compila: `cargo build --release --target wasm32-unknown-unknown`
5. Gera bindings: `wasm-bindgen --out-dir ... --target web`
6. Output: `src/games/{jogo}/ai/wasm/pkg/`

### Fallback Strategy

```
WASM disponível? ─────Yes────→ Usa Rust/WASM Engine
        │
        No
        ↓
Worker carregou? ─────Yes────→ Usa TypeScript Engine (Worker)
        │
        No
        ↓
Usa TypeScript Engine (Síncrono, bloqueia UI)
```

---

## Documentação Técnica Adicional

Para detalhes de implementação específicos de cada IA, consulta:

- [`docs/QUELHAS-IA.md`](./docs/QUELHAS-IA.md) - Estratégia PVS e Island Solver
- [`docs/PRODUTO-IA.md`](./docs/PRODUTO-IA.md) - MCTS e heurísticas hexagonais
- [`docs/ATARIGO-IA.md`](./docs/ATARIGO-IA.md) - Táticas de captura
- [`docs/NEX-IA.md`](./docs/NEX-IA.md) - Estratégias de conexão
