# F4.2.2 — Ajuste Atari Go ladder (separacao N2/N3)

Data: 2026-03-20  
Escopo: `docs/agents/plans/f4-calibracao-dificuldade.md` (F4.2.2)

## Objetivo da unidade
Melhorar separacao N-C2 com foco em `N2>N1` e `N3>N2` com mudanca minima no baseline, sem alterar o shape de `baseline.json`.

## Alteracao aplicada (diff minimo)
Arquivo alterado:
- `scripts/atari-go-ladder-baseline.ts`

Mudanca:
- Introduzido `EVAL_CAP_BY_LEVEL` (N1..N5) para limitar quantos candidatos passam por `simulateMove` durante `scoreMoves`.
- `scoreMoves` agora recebe `level` e aplica cap por nivel antes de avaliar candidatos.
- `chooseMove` apenas passa o `level` para `scoreMoves`.

Valores aplicados:
- N1: 6
- N2: 10
- N3: 16
- N4: 24
- N5: 40

## Racional
- Antes: todos os niveis simulavam todas as jogadas legais, comprimindo diferencas de custo e de selecao media.
- Agora: niveis baixos/medios avaliam menos candidatos, reduzindo custo e introduzindo separacao operacional explicita entre N2 e N3.
- O contrato do output foi preservado: nenhuma interface/estrutura de `AtariGoBaselineResult` foi alterada.

## Testes executados
Comando:
- `bun test scripts/atari-go-ladder-baseline.test.ts`

Resumo do output:
- `1 pass`, `0 fail`
- teste: `atari-go-ladder-baseline script > generates JSON summary with N-C2/N-C3 consistency fields`

## Compatibilidade
- `scripts/atari-go-ladder-baseline.test.ts` nao precisou de alteracoes.
- Shape de `baseline.json` mantido para hardening.
