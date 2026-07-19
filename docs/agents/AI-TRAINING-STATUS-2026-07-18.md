# Estado do treino e força das IAs — 2026-07-18

Este documento é a auditoria corrente dos planos históricos
`AI-IMPROVEMENT-PLAN.md`, `PLANO-*-IA.md` e `ROADMAP-CRJM.md`. Esses planos
continuam úteis como desenho técnico, mas várias checkboxes e estimativas ELO
já não descrevem o repositório atual.

## Estado confirmado

| Jogo | Motor atual | Evidência reproduzível | Estado |
|---|---|---|---|
| Atari Go | Rust/WASM N1–N5 + AlphaZero/PyTorch N6 | `az-v1`: 30 iterações, 60 000 jogos, 22 promoções; arena emparelhada N6 vs N5; testes de regras, workers, proxy e deadline | N6 integrado; treino longo concluído |
| Nex | Rust/WASM com TT Zobrist, iterative deepening, killers/history, deadline e ordenação por caminho mínimo 0-1 BFS | duelo release 50 jogos vs legado (2026-07-19): agente 48/50, verificação independente 47/50 (94%), overshoot 0 ms | **meta 85% fechada** (ordenação: própria no caminho próprio, neutra no caminho rival) |
| Gatos & Cães | worker TypeScript com negamax, alpha-beta e TT | testes de profundidade, legalidade, TT e budget | reescrita de busca concluída; Rust/WASM não é prioridade imediata |
| Produto | Rust/WASM MCTS N5 + fallback TypeScript N5 com lookahead e táticas de sabotagem | arena n=50 a 2 s (2026-07-19): **WASM 19–31 TS (38%)**, 0 ilegais, p95 TS 394 ms vs WASM 2000 ms — o 7–3 de n=10 era ruído; assimetria de 2.º jogador (34/50) | **redesenho concluído (2026-07-19)**: alpha-beta com iterative deepening, TT u128 e avaliação incremental (union-find) substitui o bandit UCT plano; débito ×2100; arena n=50 seed nova: **WASM 50-0 TS** (25/25 com cada cor, 0 ilegais) e 20-0 pós-correções da revisão Codex (deadline em todos os loops, fallbacks sem panic); WASM reativado como N5 (PREFER_TS_ENGINE=false) |
| Dominório | Rust/WASM + worker/fallback + livro | arena n=60 (2026-07-19): N5 (hardPlus) 51–9 N4 (hard), 0 ilegais | hierarquia de topo demonstrada |
| Quelhas | Rust/WASM PVS + solver exato de finais (N4/N5) + rede az-quelhas | árbitro exato: 0 blunders em 67 finais; arena az vs N5 WASM: 39–1 (97,5%) | rede muito superior ao motor clássico; integração como N6 pendente de decisão |

As estimativas ELO do plano de 2025 não foram produzidas por um rating pool e
não devem ser usadas como medição de força.

## Trabalho concluído nesta continuação

1. A arena Atari Go passou a usar o N5 Rust/WASM real, em vez do fallback TS.
2. O deadline do N5 WASM passou a propagar cancelamento pela árvore a cada 32
   nós e preserva uma jogada legal se não completar profundidade 1.
3. O p95 do N5 com budget de 500 ms caiu de ~18,3 s para 500,02 ms.
4. A arena final emparelhada terminou N6 46–4 N5 (92%), zero jogadas
   ilegais, p95 N6 331,74 ms e p95 N5 500,02 ms.
5. O proxy N6 ficou isolado e coberto por testes de superfície, corpo máximo,
   rate limit por sessão assinada e fallback 503.
6. O rate limit usa agora a mesma configuração de cookie/segredo do
   learner-core, incluindo o segredo aleatório de desenvolvimento.
7. Os testes de robustez multiprocess do self-play passaram no container de
   referência; o build completo e a suite Bun passaram.
8. O Produto ganhou uma arena reproduzível WASM-vs-TS, com aberturas
   emparelhadas, troca de jogador, seed, validação de legalidade, latência e
   artefacto JSON. No budget real de N5 (2 s), o WASM obteve 7–3 numa amostra
   inicial de 10 jogos, sem ilegais e com p95 de 2000,49 ms.

## Ordem de execução atual

### P0 — consolidar Atari Go N6

- [x] treino longo e gating;
- [x] serviço de inferência e fallback local;
- [x] arena contra N5 WASM real;
- [x] corrigir e testar overshoot do N5;
- [x] guardar um snapshot final de 50 jogos após a correção do deadline;
- [ ] publicar/reinstalar o serviço e a app apenas quando o utilizador pedir deployment.

### P1 — força mensurável nos restantes jogos

- [x] Produto: criar duelo reproduzível WASM-vs-TS com aberturas emparelhadas,
  seed fixa, troca de jogador, legalidade e deadline;
- [x] Produto: amostra alargada a n=50 a 2 s (2026-07-19) — resultado
  invertido: TS 31–19 WASM; próxima ação: preferir o TS no caminho N5 ou
  diagnosticar o MCTS WASM (artifacts/produto-arena/2026-07-19T10-11-25-733Z);
- [x] Nex: meta fechada (2026-07-19) — 94-96% vs legado com ordenação por
  caminho mínimo 0-1 BFS; zero overshoot, suite verde;
- [x] Dominório: N5>N4 demonstrado em WASM com n=60 e seed fixa (2026-07-19):
  **51–9 (85%)**, 0 ilegais, aberturas emparelhadas
  (artifacts/dominorio-arena/2026-07-19T10-35-16-884Z);
- [ ] Gatos & Cães: acrescentar arena novo-vs-baseline antes de considerar um
  porte Rust/WASM.

### P2 — refinamentos e validação pedagógica

- [ ] Quelhas: solver exato apenas para finais pequenos e benchmark próprio;
- [ ] recolher piloto observado com alunos para P1–P10;
- [ ] calibrar os níveis com dados reais de sucesso/frustração, mantendo a
  recomendação adaptativa explícita e não automática.

## Gates para qualquer melhoria futura

Uma alteração de motor só é promovida quando cumpre simultaneamente:

1. 0 jogadas ilegais;
2. deadline dentro de `budget + 100 ms` no teste local relevante;
3. cores/aberturas emparelhadas, seed registada e **amostra n≥50** (amostras
   pequenas invertem-se: Produto 7–3 em n=10 → 19–31 em n=50);
4. resultado contra baseline guardado em `artifacts/`;
5. build WASM e suite de testes sem falhas;
6. sem alegações de “jogo perfeito” fora do que está demonstrado nas fontes.

## Reproduzir os benchmarks novos

O build WASM deve ser executado antes das arenas:

```bash
bun run build
bun run ai:arena:produto --games 10 --seed 20260719 --budget 2000 --endgame 8
```

Resultado de referência do Produto:
`artifacts/produto-arena/2026-07-18T15-49-52-151Z/results.json`. O 7–3 é uma
amostra inicial, não uma estimativa ELO nem evidência suficiente para declarar
superioridade geral. As medições de 100 e 500 ms ficaram em 40%, pelo que o
budget deve acompanhar qualquer comparação futura.
