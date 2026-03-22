# F4 Diagnosis — B1 Bias (First/Second Player Asymmetry)

**Data:** 2026-03-22
**Baseline analisado:** 2026-03-21T10:31:59 (seed=20260321, gamesPerMirror=10, budgetScale=0.05)

---

## 1. Dominorio — Causa Raiz do B1=100pp

### 1.1 Dados observados

| Par | strongerWinrate | whenStarts | whenSecond | B1 |
|-----|---------------:|----------:|----------:|---:|
| N2>N1 | 50% | 100% | 0% | 100pp |
| N3>N2 | 100% | 100% | 100% | 0pp |
| N4>N3 | 100% | 100% | 100% | 0pp |
| N5>N4 | 50% | 0% | 100% | 100pp |

### 1.2 Diferença de parametros N1 vs N2

Ambos N1 e N2 mapeiam para a dificuldade legacy `'easy'` (via `mapLevelToLegacyDifficulty`, `v1-adapter.ts:103-104`):

```
N1 → 'easy': maxDepth=4, topN=6, scoreDelta=70
N2 → 'easy': maxDepth=4, topN=6, scoreDelta=70
```

Os parametros de busca sao **identicos**. A unica diferenca e o timeBudgetMs, derivado de `DIFFICULTY_PROFILES` com `budgetScale=0.05`:

```
N1: 100ms * 0.05 = 5ms
N2: 250ms * 0.05 = 13ms
```

Com `maxDepth=4` e iterative deepening, ambos completam as mesmas profundidades (1-3 plies) dentro destes budgets minusculos. O resultado: **N1 e N2 jogam de forma efectivamente identica**.

**Evidencia:** `v1-adapter.ts:103-104` (ambos `'easy'`), `types.ts:31-36` (parametros identicos), `ai-core/difficulty.ts:16-28` (time budgets N1=100ms, N2=250ms).

### 1.3 Diferenca de parametros N4 vs N5

```
N4 → 'hard':     maxDepth=13, topN=0, scoreDelta=0 (deterministico)
N5 → 'hardPlus': maxDepth=17, topN=0, scoreDelta=0 (deterministico)
```

Com `budgetScale=0.05`:
```
N4: 1000ms * 0.05 = 50ms
N5: 2000ms * 0.05 = 100ms
```

Ambos deterministicos (`topN=0`). A diferenca de depth (13 vs 17) e de tempo (50ms vs 100ms) e insuficiente para gerar separacao real: alpha-beta com branching factor ~25 nao consegue atingir depth 13 em 50ms, portanto ambos atingem a mesma profundidade efetiva (~5-7 plies). **N4 e N5 jogam de forma quasi-identica**.

**Evidencia:** `types.ts:42-55` (presets), `v1-adapter.ts:105-108` (mapping).

### 1.4 Explicacao da inversao do bias

O padrao "J1 ganha sempre" em N2>N1 e "J2 ganha sempre" em N5>N4 nao e um bug — e uma propriedade estrutural do Domineering no tabuleiro 8x8:

- **Niveis baixos (busca rasa + randomizacao):** Com `topN=6, scoreDelta=70`, ambos jogam quasi-aleatoriamente entre jogadas razoaveis. A vantagem pratica do primeiro jogador (reclamar espaco primeiro) domina. J1 (Vertical) ganha sistematicamente.

- **Niveis altos (busca profunda + deterministico):** Com `topN=0`, o motor joga a melhor jogada encontrada. Em Domineering 8x8, a analise computacional mostra que o segundo jogador (Horizontal) tem vantagem teorica. A funcao de avaliacao (`evaluateAdvanced`, `bitboard.ts:243-261`) com pesos defensivos (oppMoves*15 > myMoves*10, oppSafe*25 > mySafe*20) e suficientemente precisa para capturar esta vantagem quando a busca e profunda. J2 (Horizontal) ganha sistematicamente.

**Conclusao:** O bias inverte porque o equilibrio entre vantagem pratica (J1) e vantagem teorica (J2) muda com a profundidade de busca. O problema fundamental e que **N1≈N2 e N4≈N5 em forca**, logo o resultado e determinado inteiramente pelo bias de lado.

### 1.5 Opening book

O opening book (`book.json`) oferece as mesmas jogadas para ambos os lados no tabuleiro vazio (`"0:0:0"` e `"0:0:1"` ambos com `[27, 35, 28, 36]`). A seed key inclui `difficulty`, e como N1 e N2 ambos usam `'easy'`, selecionam a mesma jogada do book. Isto confirma a identidade funcional dos dois niveis.

Para N4/N5, o book e bypassed pela `applyTopLevelStabilityPolicy` (`v1-adapter.ts:134-161`) que preenche `dominosColocados` para exceder `OPENING_BOOK_MAX_PLY=6`.

### 1.6 Hipotese principal

**Causa raiz: Colapso de parametros entre niveis adjacentes.**
- N1 e N2 mapeiam para o mesmo preset `'easy'` com parametros identicos
- N4 e N5 mapeiam para presets semelhantes com `topN=0` e budgets insuficientes para diferenciacao
- O `budgetScale=0.05` amplifica o problema ao reduzir os budgets de tempo a valores minusculos (5-100ms)

---

## 2. Atari Go — Causa Raiz do B1=20pp

### 2.1 Dados observados

| Par | strongerWinrate | whenStarts | whenSecond | B1 |
|-----|---------------:|----------:|----------:|---:|
| N2>N1 | 90% | 80% | 100% | 20pp |
| N3>N2 | 95% | 100% | 90% | 10pp |
| N4>N3 | 100% | 100% | 100% | 0pp |
| N5>N4 | 90% | 100% | 80% | 20pp |

B1 maximo = 20pp (limite: 10pp). Jogos especificos com perda:
- N2>N1 como J1: 2v1-A-2 (12 plies), 2v1-A-9 (14 plies) — derrotas rapidas
- N5>N4 como J2: 5v4-B-7 (39 plies), 5v4-B-10 (27 plies)

### 2.2 Fontes de assimetria identificadas

#### a) `evalCap` com ordenacao fixa (causa principal)

`calcularJogadasValidas` (`logic.ts:148-164`) gera jogadas em ordem row-major (linha 0→8, coluna 0→8). A funcao `scoreMoves` (`atari-go-ladder-baseline.ts:249-282`) trunca a avaliacao apos `evalCap` jogadas:

```typescript
if (index >= evalCap) {
    return { move, baseScore: Number.NEGATIVE_INFINITY };
}
```

Com N1 (`evalCap=6`), apenas 6 de ~80 jogadas sao avaliadas — sempre as do canto superior-esquerdo. Com N2 (`evalCap=10`), 10 jogadas. Esta truncacao cria um vies posicional sistematico: o motor "ve" apenas uma fracao do tabuleiro, e a fracao visivel depende da ordem de scan.

J1 (primeiro a jogar) ocupa posicoes no canto superior-esquerdo, o que desloca as jogadas de J2 dentro da janela `evalCap`. O efeito e assimetrico porque J1 influencia quais jogadas de J2 ficam dentro do cap.

**Evidencia:** `atari-go-ladder-baseline.ts:261-263`, `logic.ts:152-153`.

#### b) RNG partilhado entre jogadores

Um unico gerador `random()` e criado por jogo (`atari-go-ladder-baseline.ts:433-435`) e partilhado entre ambos os jogadores. J1 consome valores RNG primeiro (para `rankIndexForLevel` e `evaluateCandidateSafety`), alterando o estado RNG para J2. Isto acopla as decisoes de blunder entre jogadores — nao sao independentes.

**Evidencia:** `atari-go-ladder-baseline.ts:433-435` (unico `createRandom`), `atari-go-ladder-baseline.ts:448` (mesmo `random` passado a `chooseMove` para ambos os jogadores).

#### c) `distanceToCenter` (efeito secundario)

A penalizacao `distanceToCenter(move)` (`atari-go-ladder-baseline.ts:271`) favorece jogadas centrais. J1 reclama o centro primeiro, ganhando uma ligeira vantagem posicional persistente. Contudo, o peso e pequeno (~4 pontos vs capturas a 350 pontos).

**Evidencia:** `atari-go-ladder-baseline.ts:244-247`, `atari-go-ladder-baseline.ts:271`.

### 2.3 Hipotese principal

**Causa raiz composta:**
1. **`evalCap` + ordenacao row-major** cria vies posicional que afecta J1 e J2 de forma assimetrica
2. **RNG partilhado** acopla decisoes de blunder, amplificando assimetria em amostras pequenas (10 jogos)
3. **Amostra de 10 jogos** amplifica a variancia (1 jogo = 10pp; 2 jogos = 20pp)

---

## 3. Plano de Correccao Proposto

### 3.1 Dominorio — Separar parametros N1/N2 e N4/N5

**Accao minima:**

1. **Diferenciar N1 e N2 no preset level-mapping** (`v1-adapter.ts:103-108`):
   - Opcao A (recomendada): Criar preset intermediario entre `'easy'` e `'medium'` para N2, com `topN=4, scoreDelta=40` (vs N1 com `topN=6, scoreDelta=70`). Isto da a N2 jogadas menos aleatorias sem mudar a profundidade.
   - Opcao B: Manter ambos em `'easy'` mas reduzir `topN` de N1 para 8 e aumentar `scoreDelta` para 100, degradando deliberadamente N1.

2. **Diferenciar N4 e N5** (`types.ts:42-55`):
   - Aumentar `maxDepth` de `'hardPlus'` para 21+ (pouco efeito pratico com budgets baixos)
   - OU adicionar transposition table a `'hardPlus'` (a AI ja nao usa TT — `ttHitRate` e sempre 0)
   - OU dar a N5 um bonus de avaliacao (e.g., `mySafe * 30` em vez de `mySafe * 20`) para diferenciar a qualidade de jogo

3. **Aumentar `budgetScale` no benchmark** para >= 0.2 (actualmente 0.05), dando aos motores tempo suficiente para diferenciar:
   - N1: 100ms * 0.2 = 20ms
   - N2: 250ms * 0.2 = 50ms
   - N4: 1000ms * 0.2 = 200ms
   - N5: 2000ms * 0.2 = 400ms

**Risco de regressao:** Baixo para N3>N2 e N4>N3 (ja passam a 100%, e a separacao de parametros entre esses pares e grande). Medio para pedagogy metrics (alterar parametros pode mudar `explainText` patterns).

### 3.2 Atari Go — Decorrelacionar assimetria

**Accao minima:**

1. **Separar RNG por jogador** (`atari-go-ladder-baseline.ts:433-448`):
   - Criar dois geradores: `randomJ1 = createRandom(deriveSeed(seed, gameId + ':j1'))` e `randomJ2 = createRandom(deriveSeed(seed, gameId + ':j2'))`
   - Passar o RNG do jogador corrente a `chooseMove`
   - Isto decorrelaciona as decisoes de blunder

2. **Embaralhar `jogadasValidas` antes de aplicar `evalCap`** (`atari-go-ladder-baseline.ts:261`):
   - Usar o RNG do jogador para shuffle das jogadas antes de truncar por `evalCap`
   - Isto elimina o vies posicional row-major

3. **Considerar aumentar amostra** para `gamesPerMirror=20` nos pares com B1 elevado, para reduzir variancia estatistica.

**Risco de regressao:** Medio. Mudar a distribuicao de jogadas avaliadas pode alterar winrates T1 em pares ja aprovados. Recomenda-se correr baseline completo apos cada alteracao.

### 3.3 Ordem de execucao recomendada

1. **Dominorio — budgetScale** (risco baixo, rapido de testar)
2. **Atari Go — separar RNG** (risco baixo, cirurgico)
3. **Atari Go — shuffle pre-evalCap** (risco medio, pode afetar T1)
4. **Dominorio — diferenciar N1/N2** (risco medio, requer novo preset)
5. **Dominorio — diferenciar N4/N5** (risco medio, varias opcoes)

---

## 4. Criterios de Validacao Pos-Correccao

Apos as correccoes, o proximo baseline deve mostrar:

| Metrica | Target | Actualmente |
|---------|--------|------------|
| Dominorio N2>N1 winrate | >= 60% | 50% |
| Dominorio N5>N4 winrate | >= 54% | 50% |
| Dominorio B1 (max) | <= 10pp | 100pp |
| Dominorio N3>N2, N4>N3 | >= 58%/56% (nao regredir) | 100%/100% |
| Atari Go B1 (max) | <= 10pp | 20pp |
| Atari Go T1 todos os pares | >= thresholds (nao regredir) | PASS |

**Nota:** Se o `budgetScale` for aumentado, os tempos T2 (p50/p95) vao mudar. Verificar que T2 continua a passar com o novo scale.

---

## 5. Resumo Executivo

| Jogo | Gap | Causa raiz | Severidade | Fix estimado |
|------|-----|-----------|-----------|-------------|
| Dominorio | B1=100pp (N2>N1) | N1≈N2 (mesmo preset 'easy') | Critica | Diferenciar presets |
| Dominorio | B1=100pp (N5>N4) | N4≈N5 (ambos deterministicos, budgets insuficientes) | Critica | Diferenciar avaliacao + budgetScale |
| Atari Go | B1=20pp (N2>N1, N5>N4) | RNG partilhado + evalCap com scan order fixo | Moderada | Separar RNG + shuffle |
