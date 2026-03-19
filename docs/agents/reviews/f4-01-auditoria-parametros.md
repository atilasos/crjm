# F4.01 — Auditoria dos parâmetros atuais

Data: 2026-03-19
Escopo: Task 1 de `docs/agents/plans/f4-calibracao-dificuldade.md`

## Ficheiros auditados
- `src/ai-core/difficulty.ts`
- `src/games/dominorio/ai/*`
- `src/games/atari-go/ai/*`
- `artifacts/dominorio-baseline/latest/baseline.md`
- `scripts/atari-go-ladder-baseline.ts`

## Mapeamento por nível (budgets, randomness, depth, topN, heurísticas)

| Nível | AI Core (`difficulty.ts`) | Dominório (V1 -> legacy -> preset) | Atari Go runtime (V1 -> legacy -> preset) | Atari Go baseline ladder (`scripts/atari-go-ladder-baseline.ts`) |
| --- | --- | --- | --- | --- |
| N1 | budget 100ms; searchIntensity 0.35; randomness 0.30 | `N1 -> easy`; preset `easy`: budget 3000ms, `maxDepth=4`, `topN=5`, `scoreDelta=50` (aleatoriza entre candidatos próximos) | `N1 -> easy`; preset `easy`: `timeMs=3000`, `level=1` (WASM) | escolhe `rankIndex=3` (4.ª melhor, se existir); sem budget enforcement real na escolha |
| N2 | budget 250ms; searchIntensity 0.50; randomness 0.22 | `N2 -> easy`; igual a N1 no bucket legacy | `N2 -> easy`; igual a N1 no bucket legacy | escolhe `rankIndex=2` (3.ª melhor) |
| N3 | budget 500ms; searchIntensity 0.70; randomness 0.12 | `N3 -> medium`; preset `medium`: budget 8000ms, `maxDepth=7`, `topN=3`, `scoreDelta=20` | `N3 -> medium`; preset `medium`: `timeMs=6000`, `level=2` | escolhe `rankIndex=1` (2.ª melhor) |
| N4 | budget 1000ms; searchIntensity 0.88; randomness 0.05 | `N4 -> hard`; preset `hard`: budget 15000ms, `maxDepth=12`, `topN=0`, `scoreDelta=0` (determinístico) | `N4 -> hard`; preset `hard`: `timeMs=10000`, `level=3` | escolhe sempre melhor score (`rankIndex=0`) |
| N5 | budget 2000ms; searchIntensity 1.00; randomness 0.00 | `N5 -> hard`; igual a N4 no bucket legacy | `N5 -> very-hard`; preset `very-hard`: `timeMs=15000`, `level=4` | melhor score com filtro de segurança nos top-4 (penaliza resposta adversária com captura imediata) |

Notas de heurísticas:
- Dominório: `orderMoves` + `evaluateAdvanced`; randomização no opening book e em `topN/scoreDelta` nos níveis fáceis/médios.
- Atari Go runtime: Worker WASM com `best_move(timeMs, level)`; fallback TS usa `jogadaComputador` (heurística local com ruído `Math.random()*5`).
- Atari Go ladder: scoring explícito por captura imediata, capturas, atari no adversário, liberdades próprias, distância ao centro; não usa o Worker/adapter de produção.

## Diagnóstico — colapso Dominório N3–N5

Evidência (`artifacts/dominorio-baseline/latest/baseline.md`):
- `N3>N2`, `N4>N3`, `N5>N4` falham (todos 50%).
- `T4` divergência 50%.

Causas prováveis:
1. Compressão de níveis no mapeamento V1: `N4` e `N5` caem no mesmo bucket `hard` (mesmos `maxDepth/topN/scoreDelta`).
2. Diferenciação N4 vs N5 depende quase só de budget, mas o baseline mostra tempos reais muito abaixo do teto (p50 ~50ms vs ~100ms), sugerindo que o extra budget pouco muda decisão.
3. Aleatoriedade de opening book (seleção aleatória de entrada) aplica-se transversalmente e pode mascarar diferenças de força no início.
4. Amostragem pequena (8 jogos espelhados) com alta variância + T4 já instável reforça empate estatístico entre níveis adjacentes.

## Diagnóstico — gap Atari Go N-C2 / N-C3

Evidência (F3.2/hardening + `artifacts/atari-go-baseline/latest/baseline.json`):
- `N-C2` falha: todos os pares do ladder falham.
- `N-C3` falha: níveis fora de budget; em F3.2 houve passo não-monótono (`N4>=N3`), apesar de monotonicidade mínima passar.

Causas prováveis:
1. O baseline ladder não mede o mesmo pipeline de IA do jogo (não chama `AtariGoAIClient`/worker); usa política própria por ranking, reduzindo validade de N-C2 para runtime real.
2. Separação fraca entre N1..N4 no ladder (`4.ª/3.ª/2.ª/1.ª` melhor jogada) gera diferenças pequenas e muitos empates por timeout.
3. `maxPliesPerGame` curto no modo lite e dinâmica de primeira captura favorecem `draw-timeout`, achatando winrate entre níveis.
4. `N-C3` usa budgets derivados de `DIFFICULTY_PROFILES` com `budgetScale=0.05` (5..100ms), mas o custo da heurística do ladder não é limitado por budget; resultado: quase todos níveis excedem budget e N5 tem salto grande por lookahead extra.

## Hipóteses acionáveis (curtas)

1. Dominório: separar explicitamente N4 e N5 (preset/override distinto em depth e/ou política de seleção no root), mantendo contrato V1.
2. Dominório: reduzir impacto da aleatoriedade no opening (ex.: determinístico em N4/N5, aleatório só N1..N3).
3. Atari Go: alinhar o baseline ladder com o pipeline de runtime (ou assumir claramente que é proxy e calibrar thresholds/política para esse proxy).
4. Atari Go: reforçar separação de níveis médios (N2/N3) e ajustar `maxPlies`/cenários para reduzir `draw-timeout` como resultado dominante.
