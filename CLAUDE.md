# CLAUDE.md - AI Assistant Guide for CRJM

This document provides guidance for AI assistants working on the **Jogos Matemáticos CRJM** codebase.

## Project Overview

CRJM is a training platform for the Regional Mathematics Games Championship (Campeonato Regional de Jogos Matemáticos) in Madeira, Portugal. It provides:

- 6 mathematical board games with AI opponents
- Tournament system with double-elimination brackets
- Rust/WASM engines for high-performance AI
- React 19 frontend with TypeScript

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun 1.x |
| Language | TypeScript (strict mode) |
| Frontend | React 19 + Tailwind CSS 4 |
| AI Engines | Rust → WebAssembly + TypeScript fallback |
| Build | Custom Bun build script (`build.ts`) |
| Testing | Bun test runner |

## Quick Commands

```bash
bun run dev          # Development server with hot reload
bun run build        # Production build (includes WASM)
bun run build -- --skip-wasm  # Build without WASM
bun run tournament   # Start tournament server on :4000
bun test             # Run all tests
```

## Project Structure

```
/
├── src/
│   ├── games/           # Game implementations
│   │   ├── gatos-caes/  # Cats & Dogs (1º Cycle)
│   │   ├── dominorio/   # Dominoes variant (1º, 2º)
│   │   ├── quelhas/     # Segments game - MISÈRE (1º-3º)
│   │   ├── produto/     # Product game (2º-Sec)
│   │   ├── atari-go/    # Capture Go (3º-Sec)
│   │   └── nex/         # Connection game (Sec)
│   ├── components/      # Shared React components
│   ├── server/          # Tournament server
│   │   ├── tournament-server.ts
│   │   ├── tournament-engine.ts
│   │   └── game-adapter.ts
│   └── tournament/      # Tournament client & protocol
├── wasm/                # Rust AI engines
│   ├── dominorio_ai/
│   ├── quelhas/         # Workspace with 3 crates
│   ├── produto_ai/
│   ├── atari_go_ai/
│   └── nex_ai/
├── docs/                # Detailed AI documentation
└── build.ts             # Build system
```

## Game Structure Pattern

Each game follows a consistent structure:

```
src/games/{game}/
├── logic.ts           # Pure game rules, state management
├── types.ts           # TypeScript type definitions
├── logic.test.ts      # Unit tests
├── {Game}Game.tsx     # React UI component
└── ai/
    ├── ai-client.ts   # AI interface + TS fallback engine
    ├── types.ts       # AI-specific types
    └── {game}.worker.ts  # Web Worker entry point
```

## Code Style Guidelines

### TypeScript

- Strict mode enabled - no implicit any
- Path alias: `@/*` maps to `./src/*`
- Use explicit return types on exported functions
- Prefer `const` over `let`, avoid `var`

### Game Logic

- Keep `logic.ts` pure - no side effects, no React
- All state transitions should be immutable
- Test edge cases in `logic.test.ts`

### AI Implementation

- Workers must handle `compute_move` and `cancel` messages
- Return moves as packed integers when possible
- Include difficulty level support (1-5)
- Implement time budgets per move

### React Components

- Functional components only
- Use hooks for state management
- Keep game UI in `{Game}Game.tsx`

## Adding a New Game

1. Create directory `src/games/{new-game}/`
2. Implement `logic.ts` with:
   - `createInitialState()`
   - `applyMove(state, move)`
   - `isValidMove(state, move)`
   - `isGameOver(state)`
   - `getWinner(state)`
   - `getValidMoves(state)`
3. Add types in `types.ts`
4. Create React component `{NewGame}Game.tsx`
5. Add AI in `ai/` subdirectory
6. Create Web Worker in `ai/{new-game}.worker.ts`
7. (Optional) Create Rust engine in `wasm/{new_game}_ai/`
8. Add to `game-adapter.ts` for tournament support
9. Add route in main App

## Working with AI Engines

### TypeScript Engine

Located in `src/games/{game}/ai/ai-client.ts`:

```typescript
export async function computeMove(
  state: GameState,
  difficulty: number,
  signal?: AbortSignal
): Promise<Move> {
  // Implementation
}
```

### Web Worker

Workers communicate via messages:

```typescript
// Request
{ type: 'compute_move', state, difficulty, requestId }

// Response
{ type: 'move_result', move, requestId, metrics? }

// Cancel
{ type: 'cancel' }
```

### Rust/WASM Engine

Rust crates in `wasm/` compile to WASM:

```rust
#[wasm_bindgen]
pub fn compute_move(state_json: &str, difficulty: u8) -> String {
    // Returns JSON-encoded move
}
```

## Tournament System

### Server Architecture

- Runs on Bun HTTP server (default port 4000)
- WebSocket endpoint at `/ws`
- Admin panel at `/admin`
- Environment: `PORT`, `ADMIN_KEY`

### Adding Tournament Support

1. Implement game adapter in `src/server/game-adapter.ts`:

```typescript
case 'new-game':
  return {
    createInitialState: () => createNewGameState(),
    applyMove: (s, m) => applyNewGameMove(s, m),
    isValidMove: (s, m) => isValidNewGameMove(s, m),
    isGameOver: (s) => isNewGameOver(s),
    getWinner: (s) => getNewGameWinner(s),
    getCurrentPlayer: (s) => s.currentPlayer,
  };
```

2. Add game board component to tournament UI

### Protocol Types

Key message types in `src/tournament/protocol.ts`:

- `JoinTournamentMessage`
- `SubmitMoveMessage`
- `TournamentStateUpdateMessage`
- `MatchAssignedMessage`

## Testing

Run all tests:
```bash
bun test
```

Run specific game tests:
```bash
bun test src/games/quelhas/logic.test.ts
```

### Test Coverage Focus

- Game logic edge cases
- Win/draw detection
- Invalid move rejection
- AI move validity

## Build System

The `build.ts` script handles:

1. **Main app build** - React + Tailwind
2. **Worker builds** - Separate bundles for each AI worker
3. **WASM builds** - Rust compilation (if toolchain available)

### WASM Build Requirements

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
```

### Fallback Behavior

- No Rust toolchain → Uses TypeScript AI
- Worker fails to load → Synchronous computation (blocks UI)

## Common Tasks

### Improve AI Performance

1. Profile with browser DevTools
2. Optimize hot paths in Rust or TypeScript
3. Consider bitboard representations
4. Add transposition tables for repeated states
5. Tune time budgets per difficulty level

### Fix Game Logic Bug

1. Write failing test in `logic.test.ts`
2. Fix logic in `logic.ts`
3. Verify test passes
4. Check AI still produces valid moves

### Add Difficulty Level

1. Update difficulty handling in worker
2. Adjust time budget or search depth
3. Test across all difficulty levels

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/games/{game}/logic.ts` | Game rules |
| `src/games/{game}/ai/ai-client.ts` | AI interface |
| `src/server/game-adapter.ts` | Tournament game integration |
| `src/server/tournament-engine.ts` | Bracket logic |
| `build.ts` | Build system |
| `wasm/{game}_ai/src/lib.rs` | Rust AI engine |

## Documentation

- [`AGENTS.MD`](./AGENTS.MD) - AI architecture details
- [`TORNEIO.md`](./TORNEIO.md) - Tournament hosting guide
- [`docs/`](./docs/) - Game-specific AI documentation

## Performance Considerations

- AI computation happens in Web Workers (non-blocking)
- WASM engines are 10-100x faster than TypeScript
- Use bitboards for board representations when possible
- Packed integer moves reduce serialization overhead

## Security Notes

- Tournament server validates all moves server-side
- Never trust client state
- `game-adapter.ts` is the source of truth

## Debugging Tips

1. Check browser console for worker errors
2. Use `bun run dev` for hot reload during development
3. WASM builds only work in production mode
4. Tournament server logs to console with timestamps
