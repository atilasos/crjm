# F4.04 — Ajuste incremental Atari Go ladder

Data: 2026-03-20  
Escopo: Task 4 de `docs/agents/plans/f4-calibracao-dificuldade.md`

## Contexto do gap (N-C2 / N-C3)

Na auditoria F4.01, o pipeline V1 de Atari Go mostrava compressão de níveis no adapter:
- `N1` e `N2` mapeavam para o mesmo bucket legacy (`easy`).
- `N2` e `N3` tinham separação fraca no runtime efetivo.

Isto reduzia a observabilidade da escada no ponto médio (especialmente N2 vs N3), impactando a consistência esperada em `N-C2` (tendência de força monotónica) e dificultando leitura de progressão operacional em `N-C3`.

## Mudança mínima aplicada

Ficheiro alterado:
- `src/games/atari-go/ai/v1-adapter.ts`

Ajuste no mapeamento V1 -> legacy:
- Antes: `N1,N2 -> easy`, `N3 -> medium`, `N4 -> hard`, `N5 -> very-hard`
- Depois: `N1 -> easy`, `N2 -> medium`, `N3 -> hard`, `N4,N5 -> very-hard`

Objetivo do ajuste:
- Eliminar colapso `N1/N2` no adapter.
- Tornar `N2` e `N3` buckets adjacentes distintos no runtime real, sem alterar contrato V1.

## Testes atualizados/adicionados

Ficheiro alterado:
- `src/games/atari-go/ai/v1-adapter.test.ts`

Mudanças:
- Atualização das expectativas de `mapLevelToLegacyDifficulty`.
- Novo teste de regressão: valida que o adapter encaminha `N2` como `medium` e `N3` como `hard` para o client.

## Evidência de validação

Comandos executados:
- `bun test src/games/atari-go/ai/v1-adapter.test.ts` -> **PASS** (5 testes)
- `bun test scripts/atari-go-ladder-baseline.test.ts` -> **PASS** (1 teste)

Nota:
- `scripts/atari-go-ladder-baseline.ts` não foi alterado nesta unidade; o teste do baseline foi executado para garantir compatibilidade do artefacto/shape `nC2`/`nC3`.

## Compatibilidade

- Contrato V1 preservado (`AIResponseV1` sem alterações de schema).
- Alteração restrita ao mapeamento de dificuldade no adapter Atari Go + testes associados.
