# AI Improvement Plan - Master Level

This document outlines a comprehensive plan to upgrade all game AIs from their current state to master-level play, making them genuinely challenging for competitive training.

> **Auditoria de 2026-07-18:** este é um plano histórico e as estimativas ELO
> abaixo não são ratings medidos. Gatos & Cães já recebeu negamax/TT em worker;
> Nex recebeu TT/iterative deepening/PVS/LMR; Atari Go recebeu um pipeline
> AlphaZero N6 treinado. O estado confirmado, resultados reproduzidos e ordem
> de execução atual estão em
> [`docs/agents/AI-TRAINING-STATUS-2026-07-18.md`](./agents/AI-TRAINING-STATUS-2026-07-18.md).

## Executive Summary

| Game | Current ELO | Target ELO | Priority | Effort |
|------|-------------|------------|----------|--------|
| Gatos & Cães | 800-1000 | 2000+ | **CRITICAL** | High |
| Produto | 900-1100 | 1900+ | **CRITICAL** | High |
| Nex | 1400-1600 | 2000+ | HIGH | Medium |
| Atari Go | 1200-1600 | 2000+ | HIGH | Medium |
| Dominório | 1400-1600 | 2000+ | MEDIUM | Low |
| Quelhas | 1700-1900 | 2100+ | LOW | Low |

---

## Phase 1: Critical Fixes (Gatos & Cães + Produto)

These games have fundamentally broken AI that needs complete rewriting.

### 1.1 Gatos & Cães - Complete Rewrite

**Current State**: 1-ply greedy heuristic with random perturbation. Cannot see any tactical sequences.

**Root Cause**: No search algorithm implemented - only static evaluation.

#### Implementation Plan

```
src/games/gatos-caes/ai/
├── ai-client.ts          # New AI interface
├── engine.ts             # New search engine
├── eval.ts               # Evaluation function
├── tt.ts                 # Transposition table
├── gatos-caes.worker.ts  # Web Worker
└── types.ts              # AI types

wasm/gatos_caes_ai/       # New Rust crate
├── Cargo.toml
└── src/
    ├── lib.rs            # WASM bindings
    ├── engine.rs         # Search engine
    ├── eval.rs           # Evaluation
    ├── tt.rs             # Transposition table
    └── movegen.rs        # Move generation
```

#### Algorithm: Negamax with Alpha-Beta + Iterative Deepening

```rust
fn negamax(board: &Board, depth: u8, alpha: i32, beta: i32, tt: &mut TT) -> i32 {
    // TT lookup
    if let Some(entry) = tt.probe(board.hash()) {
        if entry.depth >= depth {
            match entry.flag {
                Exact => return entry.score,
                LowerBound if entry.score >= beta => return entry.score,
                UpperBound if entry.score <= alpha => return entry.score,
                _ => {}
            }
        }
    }

    // Terminal check
    if depth == 0 || board.is_game_over() {
        return evaluate(board);
    }

    let mut best_score = -INFINITY;
    let mut best_move = None;
    let moves = generate_moves_ordered(board, tt);

    for mv in moves {
        board.make_move(mv);
        let score = -negamax(board, depth - 1, -beta, -alpha, tt);
        board.unmake_move(mv);

        if score > best_score {
            best_score = score;
            best_move = Some(mv);
        }
        alpha = max(alpha, score);
        if alpha >= beta {
            // Update killer moves
            break;
        }
    }

    // TT store
    tt.store(board.hash(), depth, best_score, best_move, flag);
    best_score
}
```

#### Evaluation Function

```rust
fn evaluate(board: &Board) -> i32 {
    let my_moves = board.count_legal_moves(board.side_to_move());
    let opp_moves = board.count_legal_moves(board.side_to_move().opposite());

    // Immediate win/loss
    if my_moves == 0 { return -10000 + board.ply() as i32; }  // I lose
    if opp_moves == 0 { return 10000 - board.ply() as i32; }  // I win

    let mut score = 0;

    // Mobility (weighted by game phase)
    let phase = board.pieces_placed() as f32 / 36.0;
    let mobility_weight = 100 + (phase * 200.0) as i32;
    score += (my_moves as i32 - opp_moves as i32) * mobility_weight;

    // Territory control (cells I can reach but opponent can't)
    let my_territory = board.reachable_cells(board.side_to_move());
    let opp_territory = board.reachable_cells(board.side_to_move().opposite());
    let exclusive_territory = (my_territory & !opp_territory).count_ones() as i32;
    score += exclusive_territory * 50;

    // Center control (early game)
    if phase < 0.3 {
        score += board.center_control(board.side_to_move()) * 30;
    }

    // Safe moves (guaranteed future moves)
    let my_safe = board.count_safe_moves(board.side_to_move());
    let opp_safe = board.count_safe_moves(board.side_to_move().opposite());
    score += (my_safe as i32 - opp_safe as i32) * 80;

    // Blocking penalty (cells that block our own movement)
    score -= board.self_blocking_count(board.side_to_move()) * 20;

    score
}
```

#### Difficulty Levels

| Level | Depth | Time (ms) | TT Size | Move Selection |
|-------|-------|-----------|---------|----------------|
| 1 (Easy) | 4 | 500 | 64K | Top 3 + random |
| 2 (Medium) | 6 | 1500 | 128K | Top 2 + random |
| 3 (Hard) | 8 | 3000 | 256K | Best move |
| 4 (Expert) | 10 | 5000 | 512K | Best move |
| 5 (Master) | 12+ | 10000 | 1M | Best move |

#### Move Ordering (Critical for Pruning)

1. **TT best move** (from previous iteration)
2. **Killer moves** (2 per ply)
3. **History heuristic** (moves that caused cutoffs)
4. **Static evaluation** (quick 1-ply score)

#### Expected Improvement

- Current: Loses to any player who can plan 2 moves ahead
- After: Should beat 95% of human players at Level 5

---

### 1.2 Produto - Proper Search Implementation

**Current State**: Shallow candidate selection (16-28 moves) with weak evaluation. Essentially playing semi-randomly.

**Root Cause**: No real search - just evaluates top candidates and picks best.

#### Implementation Plan

```
wasm/produto_ai/src/
├── lib.rs            # Improve WASM bindings
├── engine.rs         # NEW: Full negamax search
├── eval.rs           # IMPROVE: Better evaluation
├── tt.rs             # NEW: Transposition table
├── mcts.rs           # NEW: MCTS for opening/midgame
└── core/
    └── board.rs      # Existing board logic
```

#### Algorithm: MCTS + Negamax Hybrid

For Produto (hexagonal board with group scoring), pure alpha-beta struggles due to high branching factor. Use MCTS for exploration + Negamax for tactical verification.

```rust
struct MCTSNode {
    move: Option<Move>,
    visits: u32,
    wins: f32,
    children: Vec<MCTSNode>,
    unexpanded: Vec<Move>,
}

fn mcts_search(root: &Board, time_ms: u64) -> Move {
    let deadline = Instant::now() + Duration::from_millis(time_ms);
    let mut tree = MCTSNode::new_root(root);

    while Instant::now() < deadline {
        // Selection (UCB1)
        let mut node = &mut tree;
        let mut board = root.clone();

        while !node.is_leaf() && node.unexpanded.is_empty() {
            let child_idx = node.select_child_ucb1(EXPLORATION_CONSTANT);
            board.make_move(node.children[child_idx].move.unwrap());
            node = &mut node.children[child_idx];
        }

        // Expansion
        if !node.unexpanded.is_empty() {
            let mv = node.unexpanded.pop().unwrap();
            board.make_move(mv);
            node.children.push(MCTSNode::new(mv));
            node = node.children.last_mut().unwrap();
        }

        // Simulation (with tactical verification)
        let result = if board.empty_cells() <= ENDGAME_THRESHOLD {
            // Use negamax for accurate endgame
            negamax_endgame(&board, ENDGAME_DEPTH)
        } else {
            // Light playout with heuristic policy
            simulate_with_policy(&board)
        };

        // Backpropagation
        backpropagate(node, result);
    }

    tree.best_child_by_visits().move.unwrap()
}
```

#### Evaluation Function (Group Product Scoring)

```rust
fn evaluate(board: &Board) -> i32 {
    let my_groups = board.find_groups(board.side_to_move());
    let opp_groups = board.find_groups(board.side_to_move().opposite());

    // Product scoring (official rules)
    let my_product: i32 = if my_groups.len() <= 1 {
        0  // Single group = 0 points
    } else {
        my_groups.iter()
            .map(|g| g.size() as i32)
            .sorted()
            .rev()
            .take(2)
            .product()
    };

    let opp_product: i32 = /* same for opponent */;

    let mut score = (my_product - opp_product) * 100;

    // Potential connections (cells that would merge groups)
    let my_bridges = board.count_bridge_cells(board.side_to_move());
    let opp_bridges = board.count_bridge_cells(board.side_to_move().opposite());
    score += (my_bridges as i32 - opp_bridges as i32) * 30;

    // Territory (empty cells closer to my pieces)
    let my_influence = board.influence_score(board.side_to_move());
    let opp_influence = board.influence_score(board.side_to_move().opposite());
    score += (my_influence - opp_influence) * 20;

    // Piece count tiebreaker
    score += (board.piece_count(board.side_to_move()) as i32
            - board.piece_count(board.side_to_move().opposite()) as i32) * 5;

    score
}
```

#### MCTS Configuration

| Level | Simulations | Endgame Depth | Policy |
|-------|-------------|---------------|--------|
| 1 | 500 | 2 | Random |
| 2 | 2000 | 4 | Light |
| 3 | 8000 | 6 | Medium |
| 4 | 20000 | 8 | Heavy |
| 5 | 50000+ | 10+ | Expert |

#### Expected Improvement

- Current: Loses to basic strategic play
- After: Should require advanced tactics to beat at Level 5

---

## Phase 2: Depth Improvements (Nex + Atari Go)

These games have functional AI but insufficient search depth.

### 2.1 Nex - Extend to 4-6 Ply

**Current State**: Only 2-ply negamax even at "Master" level. Path-based evaluation is good but shallow search limits play.

#### Changes Required

```rust
// Current: 2-ply max
// Target: 4-6 ply with better pruning

fn negamax_nex(board: &Board, depth: u8, alpha: i32, beta: i32, tt: &mut TT) -> i32 {
    // Add transposition table (currently missing)
    if let Some(entry) = tt.probe(board.hash()) {
        // ... standard TT logic
    }

    // Add null-move pruning for Nex (safe in connection games)
    if depth >= 3 && !board.in_check() {
        board.make_null_move();
        let null_score = -negamax_nex(board, depth - 3, -beta, -beta + 1, tt);
        board.unmake_null_move();
        if null_score >= beta {
            return beta;
        }
    }

    // Add late move reductions
    let mut moves_searched = 0;
    for mv in moves {
        let reduction = if moves_searched >= 4 && depth >= 3 && !mv.is_tactical() {
            1  // Search late quiet moves with reduced depth
        } else {
            0
        };

        let score = -negamax_nex(board, depth - 1 - reduction, -beta, -alpha, tt);

        // Re-search if reduced move beats alpha
        if reduction > 0 && score > alpha {
            score = -negamax_nex(board, depth - 1, -beta, -alpha, tt);
        }

        moves_searched += 1;
        // ... rest of alpha-beta
    }
}
```

#### New Difficulty Levels

| Level | Depth | Time (ms) | TT Size | Pruning |
|-------|-------|-----------|---------|---------|
| 1 | 1 | 500 | None | None |
| 2 | 2 | 1500 | 64K | Basic |
| 3 | 3 | 3000 | 128K | LMR |
| 4 | 4 | 6000 | 256K | LMR + Null |
| 5 | 5-6 | 12000 | 512K | Full |

#### Connection-Specific Improvements

```rust
// Virtual connection detection
fn has_virtual_connection(board: &Board, color: Color) -> bool {
    // Check if player has guaranteed path even with opponent's best response
    // This is key for Nex/Hex games
}

// Threat detection for move ordering
fn is_threat_move(board: &Board, mv: Move) -> bool {
    // Does this move create a winning threat?
    board.make_move(mv);
    let threatens_win = board.distance_to_win(board.side_to_move()) <= 1;
    board.unmake_move(mv);
    threatens_win
}
```

---

### 2.2 Atari Go - Investigate and Improve

**Current State**: Black box WASM implementation. Need to analyze Rust source.

#### Investigation Steps

1. Read `wasm/atari_go_ai/src/lib.rs` thoroughly
2. Identify search algorithm and depth limits
3. Analyze evaluation function
4. Find bottlenecks

#### Likely Improvements Needed

```rust
// Atari-specific evaluation (capture = win)
fn evaluate_atari(board: &Board) -> i32 {
    // Check for groups in atari (1 liberty)
    for group in board.groups(board.side_to_move()) {
        if group.liberties() == 1 {
            return -9000;  // Our group can be captured
        }
    }
    for group in board.groups(board.side_to_move().opposite()) {
        if group.liberties() == 1 {
            return 9000;   // We can capture opponent
        }
    }

    // Liberty-based evaluation
    let my_libs = board.total_liberties(board.side_to_move());
    let opp_libs = board.total_liberties(board.side_to_move().opposite());
    let mut score = (my_libs as i32 - opp_libs as i32) * 50;

    // Group safety (2 liberties = safe-ish)
    let my_safe = board.groups(board.side_to_move())
        .filter(|g| g.liberties() >= 2)
        .count();
    score += my_safe as i32 * 100;

    // Influence/territory
    score += board.influence_score(board.side_to_move()) * 10;

    score
}

// Atari-specific move ordering
fn order_moves_atari(board: &Board, moves: &mut Vec<Move>) {
    moves.sort_by_key(|mv| {
        board.make_move(*mv);
        let score = if board.has_capture() {
            -10000  // Capturing moves first
        } else if board.saves_group_in_atari() {
            -5000   // Saving moves second
        } else if board.creates_atari() {
            -1000   // Atari threats third
        } else {
            board.liberties_after(*mv) as i32
        };
        board.unmake_move(*mv);
        score
    });
}
```

#### Target Configuration

| Level | Depth | Time (ms) | Features |
|-------|-------|-----------|----------|
| 1 | 4 | 500 | Basic |
| 2 | 6 | 1500 | + TT |
| 3 | 8 | 3000 | + Killer |
| 4 | 10 | 6000 | + History |
| 5 | 12+ | 12000 | Full + Endgame |

---

## Phase 3: Refinements (Dominório + Quelhas)

These games have decent AI but can be polished for master-level play.

### 3.1 Dominório Improvements

**Current State**: Solid alpha-beta with TT, but evaluation is simplistic.

#### Evaluation Improvements

```rust
fn evaluate_dominorio(board: &Board) -> i32 {
    let mut score = 0;

    // Current: mobility only
    // Add: space partitioning
    let partitions = board.find_partitions();
    for partition in partitions {
        let my_access = partition.accessible_by(board.side_to_move());
        let opp_access = partition.accessible_by(board.side_to_move().opposite());

        if my_access && !opp_access {
            // Exclusive territory - count guaranteed moves
            score += partition.max_dominoes() as i32 * 100;
        } else if !my_access && opp_access {
            score -= partition.max_dominoes() as i32 * 100;
        } else if my_access && opp_access {
            // Contested - use parity analysis
            let parity = partition.cell_count() % 2;
            let advantage = if board.side_to_move() == partition.first_to_move() {
                if parity == 1 { 1 } else { -1 }
            } else {
                if parity == 1 { -1 } else { 1 }
            };
            score += advantage * partition.cell_count() as i32 * 20;
        }
    }

    // Corridor detection (forced sequences)
    score += board.corridor_advantage(board.side_to_move()) * 30;

    score
}
```

#### Endgame Tablebase

For positions with ≤12 empty cells, we can solve exactly:

```rust
lazy_static! {
    static ref ENDGAME_TB: EndgameTablebase = EndgameTablebase::load("dominorio_tb.bin");
}

fn evaluate_with_tb(board: &Board) -> Option<i32> {
    if board.empty_cells() <= 12 {
        ENDGAME_TB.probe(board.hash())
    } else {
        None
    }
}
```

### 3.2 Quelhas Improvements

**Current State**: Strong PVS with good misère handling, but can improve.

#### Monte Carlo Policy Improvement

```rust
// Current: random rollouts
// Improve: policy-guided rollouts

fn rollout_with_policy(board: &Board) -> f32 {
    let mut board = board.clone();
    while !board.is_game_over() {
        // Use learned policy instead of random
        let moves = board.legal_moves();
        let weights: Vec<f32> = moves.iter()
            .map(|mv| policy_score(&board, *mv))
            .collect();

        let mv = weighted_random_choice(&moves, &weights);
        board.make_move(mv);
    }

    if board.winner() == board.side_to_move() { 1.0 } else { 0.0 }
}

fn policy_score(board: &Board, mv: Move) -> f32 {
    let mut score = 1.0;

    // Prefer moves that increase our options
    board.make_move(mv);
    let my_moves_after = board.legal_moves_count();
    let opp_moves_after = board.opponent_legal_moves_count();
    board.unmake_move(mv);

    // Misère: we want opponent to have fewer moves
    score *= (opp_moves_after as f32 + 1.0).recip();

    // Prefer central pieces (control)
    score *= 1.0 + mv.centrality() * 0.2;

    // Prefer longer pieces (restrict space)
    score *= 1.0 + mv.length() as f32 * 0.1;

    score
}
```

#### Extended Search

```rust
// Increase depth for Level 5
const LEVEL_5_CONFIG: SearchConfig = SearchConfig {
    max_depth: 24,        // Was 18
    time_limit_ms: 20000, // Was 15000
    tt_size: 1 << 22,     // 4M entries (was 220K)
    aspiration_window: 80, // Tighter window
    mc_budget_ratio: 0.08, // Less MC, more search
};
```

---

## Phase 4: Infrastructure Improvements

### 4.1 Shared Components

Create reusable AI components:

```
src/ai-common/
├── tt.ts                 # Generic transposition table
├── search.ts             # Generic alpha-beta framework
├── mcts.ts               # Generic MCTS framework
├── time-manager.ts       # Adaptive time management
└── move-ordering.ts      # Killer, history heuristics
```

### 4.2 Difficulty System Overhaul

Replace randomization with genuine depth/time limits:

```typescript
interface DifficultyConfig {
  level: 1 | 2 | 3 | 4 | 5;
  searchDepth: number;
  timeLimit: number;
  ttSize: number;

  // Remove these (fake difficulty):
  // randomTopN: number;
  // scoreDelta: number;
}

// Real difficulty through search quality, not randomness
const DIFFICULTY_PRESETS: Record<number, DifficultyConfig> = {
  1: { level: 1, searchDepth: 4,  timeLimit: 500,   ttSize: 65536 },
  2: { level: 2, searchDepth: 6,  timeLimit: 1500,  ttSize: 131072 },
  3: { level: 3, searchDepth: 8,  timeLimit: 3000,  ttSize: 262144 },
  4: { level: 4, searchDepth: 10, timeLimit: 6000,  ttSize: 524288 },
  5: { level: 5, searchDepth: 14, timeLimit: 15000, ttSize: 1048576 },
};
```

### 4.3 Performance Metrics

Add AI strength measurement:

```typescript
interface AIMetrics {
  nodesSearched: number;
  depthReached: number;
  ttHitRate: number;
  branchingFactor: number;
  evaluationsPerSecond: number;
  principalVariation: Move[];
  score: number;
  confidence: number;  // Based on search stability
}
```

---

## Implementation Order

### Sprint 1: Critical Fixes (2-3 weeks)
1. [ ] Gatos & Cães: Implement full negamax + TT
2. [ ] Gatos & Cães: Create Rust/WASM engine
3. [ ] Produto: Implement MCTS + negamax hybrid
4. [ ] Produto: Improve evaluation function

### Sprint 2: Depth Extensions (2 weeks)
5. [ ] Nex: Add TT and extend to 4-6 ply
6. [ ] Nex: Implement LMR and null-move pruning
7. [ ] Atari Go: Analyze WASM source
8. [ ] Atari Go: Improve based on findings

### Sprint 3: Refinements (1-2 weeks)
9. [ ] Dominório: Add space partitioning evaluation
10. [ ] Dominório: Create endgame tablebase
11. [ ] Quelhas: Improve MC rollout policy
12. [ ] Quelhas: Extend search depth

### Sprint 4: Infrastructure (1 week)
13. [ ] Create shared AI components
14. [ ] Overhaul difficulty system
15. [ ] Add performance metrics
16. [ ] Testing and tuning

---

## Success Criteria

### Per-Game Targets

| Game | Test | Pass Criteria |
|------|------|---------------|
| Gatos & Cães | Self-play vs old AI | New AI wins 95%+ |
| Produto | Self-play vs old AI | New AI wins 90%+ |
| Nex | Self-play vs old AI | New AI wins 85%+ |
| Atari Go | Self-play vs old AI | New AI wins 85%+ |
| Dominório | Self-play vs old AI | New AI wins 80%+ |
| Quelhas | Self-play vs old AI | New AI wins 75%+ |

### Human Testing

- Level 5 should beat intermediate club players
- Level 4 should beat casual players who know the rules well
- Level 3 should be challenging for beginners
- Level 1-2 should allow beginners to win sometimes

### Performance Targets

| Metric | Target |
|--------|--------|
| Time to move (Level 5) | ≤15 seconds |
| Memory usage | ≤50MB per game |
| WASM load time | ≤500ms |
| Nodes per second | ≥100,000 (WASM) |

---

## Risk Mitigation

### Risk: WASM Compilation Failures
- **Mitigation**: Maintain TypeScript fallback for all games
- **Action**: Test fallback path regularly

### Risk: Performance Regression
- **Mitigation**: Benchmark before/after each change
- **Action**: Create automated performance tests

### Risk: Broken Difficulty Progression
- **Mitigation**: Test all 5 levels for each game
- **Action**: Self-play tournaments between levels

### Risk: Browser Compatibility
- **Mitigation**: Test in Chrome, Firefox, Safari
- **Action**: Use only stable WASM features

---

## Appendix: Algorithm Reference

### Negamax with Alpha-Beta
```
function negamax(node, depth, α, β):
    if depth = 0 or node is terminal:
        return evaluate(node)

    value := -∞
    for each child of node:
        value := max(value, -negamax(child, depth-1, -β, -α))
        α := max(α, value)
        if α ≥ β:
            break  // β cutoff
    return value
```

### MCTS with UCB1
```
function UCB1(node):
    return node.wins/node.visits + C * sqrt(ln(parent.visits)/node.visits)

function MCTS(root, iterations):
    for i in 1..iterations:
        node := select(root)      // UCB1 tree policy
        node := expand(node)      // Add child
        result := simulate(node)  // Random playout
        backpropagate(node, result)
    return best_child(root)
```

### Principal Variation Search (PVS)
```
function PVS(node, depth, α, β):
    if depth = 0:
        return evaluate(node)

    first := true
    for each child of node:
        if first:
            score := -PVS(child, depth-1, -β, -α)
            first := false
        else:
            score := -PVS(child, depth-1, -α-1, -α)  // Null window
            if α < score < β:
                score := -PVS(child, depth-1, -β, -α)  // Re-search

        α := max(α, score)
        if α ≥ β:
            break
    return α
```
