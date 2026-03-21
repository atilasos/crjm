# F4 — Cirurgia: Gate Fix + Motor Alignment

> Substitui o ciclo F4.2.x infinito por intervenção focada em 3 fases.
> Objetivo: fechar F4 com confiança real e avançar para F5.

Data: 2026-03-21
Autor: Igor + Myau
Estado: **ATIVO**

---

## Contexto

O pipeline autónomo F4.2.x iterou 11+ sub-fases sem convergência.
Causas-raiz identificadas:
1. Gate F4 usa threshold uniforme (>=60%) que contradiz a KB (thresholds degradados por par)
2. Atari Go usa heurística com `rankIndexForLevel` dependente do oponente — não mede força real
3. Dominório tem variância excessiva por `Math.random()` sem seed no benchmark
4. Amostra insuficiente (`gamesPerMirror=1-2`) para decisões de gate

---

## Fase A — Corrigir método de medição

### A1. Gate oficial alinhado com KB
- [ ] Atualizar `scripts/hardening-f3_2.ts` (ou criar `scripts/hardening-f4.ts`) com thresholds da EVALUATION-MATRIX:
  - Dominório (busca clássica): N2>N1>=60%, N3>N2>=58%, N4>N3>=56%, N5>N4>=54%
  - Atari Go (MCTS/captura): N2>N1>=62%, N3>N2>=60%, N4>N3>=57%, N5>N4>=55%
- [ ] T4: medir com seed fixa; threshold <=15% divergência
- [ ] B1: assimetria start/second <=10 pp
- [ ] Atualizar `docs/agents/ROADMAP-CRJM.md` secção F4 com critérios revistos
- [ ] Commit: `fix(f4): align gate thresholds with EVALUATION-MATRIX`

### A2. Seed obrigatório nos benchmarks
- [ ] `scripts/atari-go-ladder-baseline.ts`: aceitar `--seed <n>` via env/CLI; usar RNG seeded em vez de `Math.random()`
- [ ] `src/games/dominorio/ai/ai-client.ts`: aceitar seed opcional para opening book selection em modo benchmark
- [ ] Dominório baseline script: propagar seed
- [ ] Commit: `fix(benchmark): add deterministic seed support`

### A3. Amostra mínima
- [ ] Default `gamesPerMirror` para >=10 no gate (pode manter <=5 para dev rápido)
- [ ] Documentar em README ou no próprio script
- [ ] Commit: `fix(benchmark): raise default sample to 10 gamesPerMirror`

**Artefacto de saída:** benchmarks reprodutíveis com seed; gate com thresholds KB-aligned.

---

## Fase B — Arrumar motores

### B1. Atari Go — política de nível autónoma
- [ ] Remover dependência de `opponentLevel` em `rankIndexForLevel()` / `chooseMove()`
- [ ] Cada nível deve ter política **autónoma**: combinação de:
  - `evalCap` (quantas jogadas avaliar)
  - `blunderRate` (probabilidade de escolher fora do top-k)
  - `safetyLookahead` (0 para N1-N2, 1-ply para N3, 2-ply para N4-N5)
- [ ] N5 deve usar lookahead de resposta do oponente (já faz parcialmente, mas só para N5)
- [ ] Expandir para N4 com lookahead 1-ply
- [ ] Testes: `scripts/atari-go-ladder-baseline.test.ts` atualizado
- [ ] Commit: `refactor(atari-go): autonomous level policy without opponent dependency`

### B2. Atari Go — baseline com protocolo novo
- [ ] Correr baseline com seed fixa + gamesPerMirror=10
- [ ] Verificar T1 por par com thresholds KB
- [ ] Se falhar, ajustar parâmetros incrementalmente (evalCap, blunder, lookahead)
- [ ] Commit: `feat(atari-go): f4 baseline with new protocol`

### B3. Dominório — separar N4/N5 e reduzir variância
- [ ] Verificar que `hard` vs `hardPlus` têm separação real:
  - `hard`: maxDepth=13, topN=0 → determinístico
  - `hardPlus`: maxDepth=15, topN=0 → determinístico
  - Se ambos dão o mesmo resultado na prática (mesma jogada), aumentar depth ou mudar heurística de ordering
- [ ] Desativar `Math.random()` no opening book em modo benchmark (usar seed)
- [ ] Correr baseline com seed fixa + gamesPerMirror=10
- [ ] Commit: `fix(dominorio): improve N4-N5 separation and seed benchmark`

**Artefacto de saída:** ambos os motores com política monotónica estável.

---

## Fase C — Gate final e avanço

### C1. Benchmark consolidado
- [ ] Correr hardening com protocolo novo (seed + amostra + thresholds KB)
- [ ] Gerar reports em `docs/reports/`
- [ ] Commit: `docs(f4): final gate benchmark with revised protocol`

### C2. Decisão
- [ ] Se PASS: fechar F4 no roadmap, abrir F5
- [ ] Se FAIL parcial: documentar gap residual e decidir se avança com nota ou itera mais uma vez
- [ ] Commit: `docs(f4): gate decision and F5 opening`

---

## Critérios PASS/FAIL do plano

| Critério | PASS | FAIL |
|---|---|---|
| Dominório T1 N2>N1 | >=60% | <60% |
| Dominório T1 N3>N2 | >=58% | <58% |
| Dominório T1 N4>N3 | >=56% | <56% |
| Dominório T1 N5>N4 | >=54% | <54% |
| Atari Go T1 N2>N1 | >=62% | <62% |
| Atari Go T1 N3>N2 | >=60% | <60% |
| Atari Go T1 N4>N3 | >=57% | <57% |
| Atari Go T1 N5>N4 | >=55% | <55% |
| T4 (ambos, seed fixa) | <=15% | >15% |
| B1 assimetria | <=10pp | >10pp |
| Amostra | >=10 gamesPerMirror | <10 |

---

## Regras de execução
- Uma task por commit
- Não avançar fase sem artefacto da anterior
- Se bloqueio conceptual, reportar ao Igor
- Não reabrir sub-fases F4.2.x — este plano substitui todo o ciclo anterior
