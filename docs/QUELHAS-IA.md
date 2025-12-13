**Post único para agente: IA forte para Quelhas (misère) em TypeScript (GitHub Pages) com motor Rust→WASM num Web Worker**

### Decisão estratégica (comparação e escolha)

* A abordagem “MC-ORDER + PVS/αβ + TT” dá força rápida, determinística e simples de integrar no browser.
* O anexo propõe H-PNS-SPSA: MCTS com política pesada de paridade, solver exacto por ilhas via Proof-Number Search (PNS) e afinação automática de pesos via SPSA, mais arquitectura Rust/WASM de alto desempenho.   
* Estratégia consolidada escolhida: **Híbrido pragmático em 3 camadas**

  1. **Backbone determinístico**: PVS-NEGAMAX(αβ) + TT + killers + history + geração dinâmica de lances por bloco
  2. **Monte Carlo só para ordenar**: MCTS/rollouts rápidos para ordenar a raiz e reduzir o branching (sem substituir αβ)
  3. **Final exacto por ilhas**: detetar componentes independentes e, quando uma ilha for pequena, resolver com **PNS** e cachear resultado por assinatura  

### Restrição crítica de implementação (GitHub Pages)

* **SharedArrayBuffer + rayon em WASM** exigem COOP/COEP; em GitHub Pages isso tipicamente não é controlável. Implementar **motor single-thread** dentro de **um Web Worker** como baseline; paralelismo real fica como opção apenas se houver isolamento por headers. 
* Web Worker é obrigatório para não bloquear UI; comunicação main↔worker por mensagens com payload mínimo (estado + tempo). 

---

## Algoritmo consolidado (pseudo-código operacional)

### A) Loop de decisão por jogada (no Worker)

```pseudo
choose_move(state, time_ms):
  deadline = now() + time_ms

  moves = generate_moves_dynamic(state)            // comprimentos k>=2 escolhidos por run
  if moves empty: return NONE                      // sem jogadas => side_to_move vence (misère)

  // 1) Ordenação barata inicial
  for m in moves:
    m.h = cheap_move_score(state, m)               // impacto em runs do adversário, splits, paridade local
  sort_desc(moves, by m.h)

  // 2) Monte Carlo move ordering (apenas raiz, budget pequeno)
  mc_budget = 0.15 * time_ms
  topN = first N moves (N ~ 12..max(0.4*|moves|))
  monte_carlo_order_root(state, topN, mc_budget, deadline)
  moves = concat(sorted(topN), rest(moves))

  // 3) Iterative deepening + PVS/αβ + TT
  best = moves[0]
  bestScore = -INF
  depth = 1
  window = aspiration_window_init

  while now() < deadline:
    (score, move) = root_pvs(state, depth, bestScore-window, bestScore+window, moves, deadline)
    if timeout: break

    if score outside window:
      (score, move) = root_pvs(state, depth, -INF, +INF, moves, deadline)
      if timeout: break
      window = grow(window)
    else:
      window = shrink(window)

    bestScore = score
    best = move
    depth++

  return best
```

### B) Pesquisa determinística (PVS/αβ) com TT e finais exactos por ilhas

```pseudo
search(state, depth, alpha, beta, deadline):
  if now() >= deadline: return eval(state)

  // Terminal misère
  moves = generate_moves_dynamic(state)
  if moves empty:
    return +WIN_SCORE(depth)     // side_to_move ganha porque não pode jogar

  // Solver de ilhas (fim de jogo)
  components = split_into_islands(state)           // componentes de vazios independentes
  if all components small enough:
    return exact_solve_by_pns(components, state)   // devolve win/loss exacto (cache por assinatura)

  if depth == 0:
    return eval(state)

  // TT probe
  if tt_hit(state, depth, alpha, beta): return tt_value

  order_moves(state, moves)                         // TT best, killers, history, cheap score

  best = -INF
  a0 = alpha
  for m in moves:
    if now() >= deadline: return eval(state)
    make(state, m)
    score = -search(state, depth-1, -beta, -alpha, deadline)
    unmake(state, m)

    if score > best: best = score; bestMove = m
    if score > alpha: alpha = score
    if alpha >= beta:
      update_killers_history(depth, m)
      break

  tt_store(state, depth, best, flag_from(best, a0, beta), bestMove)
  return best
```

### C) Ordenação Monte Carlo na raiz (policy com viés de paridade)

```pseudo
monte_carlo_order_root(state, movesTop, mc_budget, deadline):
  mc_deadline = min(deadline, now() + mc_budget)

  init stats: wins[m]=0, sims[m]=0

  while now() < mc_deadline:
    for m in movesTop:
      if now() >= mc_deadline: break
      make(state, m)
      win = rollout_policy_weighted(state)         // política pesada: prioriza exclusivas, flexibilidade k
      unmake(state, m)
      sims[m]++
      if win: wins[m]++

  for m in movesTop:
    rate = (wins[m]+1)/(sims[m]+2)                 // smoothing
    m.mc = 1000*rate + 0.001*cheap_move_score(state, m)

  sort_desc(movesTop, by m.mc)
```

Política “weighted playout” deve privilegiar jogadas críticas e preservar diversidade de comprimentos k, como no anexo. 

---

## Geração dinâmica de lances por “run” (k ideal por bloco)

```pseudo
moves_for_run(start, length L):
  if L <= 6:
    gerar tudo (todas as posições, todos os k=2..L)
  else:
    incluir:
      - extremidades: k=2 e k=3 em ambas as pontas
      - longos: k=L, k=L-1 (pos 0 e pos 1) para controlo de paridade
      - split central: escolher (pos,k) em {k=2,3,4} que maximiza "split_score"
      - anti-mobilidade: escolher (pos,k) em amostras (quartis+centro) que maximiza "block_opp_score"
    deduplicar
```

Isto explora o controlo de “paridade forçada” que o k variável permite, essencial em misère. 

---

## Avaliação (EVAL) alinhada com misère

Feature set mínimo para orientar αβ e rollouts:

* Terminais misère correctos (sem jogadas para side_to_move => vitória)
* Métricas por jogador:

  * runs com L≥2: `min_blocks = count(runs)`
  * `max_total = Σ floor(L/2)`
  * `max_excl = Σ floor(L/2)` apenas em runs “exclusivas” (células cujo run perpendicular do adversário ≤1)
  * `flex`: aproximação rápida ao nº de lances legais
* Score típico:

  * +A*(max_excl_me - max_excl_opp)
  * +B*(flex_me - flex_opp)
  * +C*(min_blocks_opp)  // em misère, obrigar o adversário a ter de jogar
  * -D*(min_blocks_me)   // evita ficar com “obrigação” de jogar demasiado
  * bónus “tempo”: se max_excl_me ≥ max_total_opp, somar margem
  * endgame: se total_max ≤ T, reforçar paridade (min_blocks_opp - min_blocks_me)

---

## Solver exacto por ilhas (PNS) + cache

* Detetar ilhas por conectividade de vazios (componentes independentes) e manter tabela por “assinatura” (bitmask normalizada + side_to_move + orientações/pie). 
* Quando uma ilha tiver dimensão tratável (ex.: ≤16 vazios), resolver via **Proof-Number Search**, armazenar resultado e reutilizar.  
* Integração prática: o solver devolve win/loss exacto e substitui EVAL nesses nós, podando buscas grandes.

---

## Afinação automática de pesos (offline)

* Implementar SPSA num runner headless (Rust nativo) para calibrar os pesos da avaliação com auto-jogo blitz, como descrito no anexo.  
* Output: `weights.json` versionado e carregado no WASM.

---

## Arquitectura Rust/WASM + TypeScript (para o agente implementar)

* Representação de estado por bitboard **u128** (ou 2×u64) para tabuleiro 10×10; operações bitwise para validar/gerar lances rapidamente. 
* Estrutura de crates recomendada: `quelhas-core` (regras + bitboards + movegen), `quelhas-ai` (PVS/TT/MC-order/PNS/SPSA runner), `quelhas-wasm` (bindings). 
* Worker: instanciar WASM no Worker e expor `chooseMove(state, timeMs)` assíncrono; UI TypeScript envia estado mínimo, recebe jogada.
* Paralelismo avançado (opcional fora de GitHub Pages): SharedArrayBuffer + wasm-bindgen-rayon, exigindo COOP/COEP. 
