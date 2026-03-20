# F4.1.2 — Dominório ajuste mínimo N4/N5

Data: 2026-03-20
Fase: F4.1 (ativo)

## Escopo executado

- Separação de preset efetivo no runtime para topo da ladder:
  - `N4 -> hard`
  - `N5 -> hardPlus`
- `hardPlus` mantém perfil determinístico (`topN=0`, `scoreDelta=0`) e aumenta apenas profundidade (`maxDepth=15`).
- Política de estabilidade para níveis topo (`N4/N5`): no início da partida, o adapter força bypass de opening book aleatório ao elevar `plyCount` efetivo acima do limite de livro.

## Racional

A reauditoria F4.1.1 indicou colapso de separação em níveis altos e variância elevada. Este ajuste evita que `N4` e `N5` fiquem no mesmo bucket efetivo e reduz uma fonte direta de não-determinismo no topo (seleção aleatória do opening book), sem alterar contrato V1 nem arquitetura do motor.

## Impacto esperado

- Melhor separação entre `N4` e `N5` por maior profundidade efetiva de `N5`.
- Menor divergência T4 em execuções repetidas nos níveis altos.
- Maior consistência de escolha nos primeiros lances de `N4/N5`.

## Verificação local

- Testes de adapter Dominório atualizados e a passar (`src/games/dominorio/ai/v1-adapter.test.ts`).
