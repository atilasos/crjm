# Issue #35 — Laboratório de Y

Data: 2026-09-17. Âmbito: [issue #35](https://github.com/atilasos/crjm/issues/35),
com a especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `e45e658373f69bcd1e1eb46e3d79b2386779ac5a`.

## Dependência e âmbito

O bloqueio técnico #31 está resolvido neste worktree: `3ccd15b` é ancestral
de HEAD e inclui regras públicas, worker, dois níveis locais e persistência
por dificuldade. A dependência transitiva #29 (`f2d3155`) também está presente.
Os 14 testes das regras de Y, motor e catálogo passaram antes da implementação.
A [arena existente](../../../artifacts/y-arena/seed-3002026.json) regista seed
3002026, 50 partidas com aberturas emparelhadas, alternância de participantes,
N2 50–0 e zero jogadas ilegais. Não foi repetido o benchmark.
A issue #31 continua aberta no GitHub; o estado administrativo não foi alterado.

Esta entrega acrescenta apenas `puzzles`, `training` e `strategy` a Y.
O percurso está em `?integracao=1#/puzzles`; ativar publicamente a edição
continua fora deste ticket. Usa o grafo de 93 nós e 252 ligações já
[validado contra o anexo](../../design/y-board-validation.md).
Os documentos e anexos preexistentes, incluindo as alterações locais em
CLAUDE.md e os ficheiros não versionados, foram preservados fora deste commit.

## Implementação

- Quatro etapas existentes, seis puzzles conceptuais e desafios N1/N2
  avaliados pelo progresso real das partidas.
- Seis situações concretas de escolha e previsão: adjacência, cantos,
  grupos separados, união de grupos, troca e vitória imediata.
- Posições construídas com jogadas legais e soluções calculadas pelas regras
  públicas. A vitória de A9 é imediata e verificável; não é uma alegação de
  vitória forçada baseada na preferência do motor.
- Identidades estáveis por situação, sem multiplicar situações por mudanças
  cosméticas. Reutilização do serviço persistente, primeira resposta imutável,
  exposição a pistas e recuperação apenas após 24 horas, sem migração.
- Puzzles conceptuais distintos das posições avaliadas, mantendo prática
  orientada separada da evidência autónoma.
- Tabuleiro oficial com símbolos, coordenadas, deslocação horizontal e
  descrição textual das adjacências para leitores de ecrã.
- Textos PT-PT/EN/NE e componentes existentes de temas, perfil e teclado.

## Standards

Revisão independente segundo a skill `code-review`: zero violações
documentadas ou recomendações por cheiros de código. A revisão inicial
identificou dois problemas comportamentais: repetição das posições entre
puzzles e avaliação, e ausência de descrição textual das ligações.
Ambos foram corrigidos e revalidados. **Zero achados pendentes.**

## Spec

Revisão independente: **zero achados pendentes**. Foram verificadas as seis
situações pelas regras públicas, incluindo D3–E3, D3 a unir C1/E3 e A9 como
única vitória imediata entre as opções. A separação entre puzzles conceptuais
e posições avaliadas foi revalidada após a correção da exposição cruzada.

## Verificação

- Suite completa final: **566 passaram, zero falhas**, 71 ficheiros.
  [Registo](../../../artifacts/y-laboratory/tests.txt).
- Testes focados: **47 passaram**, incluindo persistência, limite de 24 horas,
  percursos, puzzles, catálogo, diagrama acessível e traduções.
  [Registo](../../../artifacts/y-laboratory/focused.txt).
- TypeScript: **704 diagnósticos antes e depois**, sem novos diagnósticos
  normalizando posições de linha. [Comparação](../../../artifacts/y-laboratory/typecheck.json).
- Build completo com os cinco WASM e verificação de idiomas passou.
  [Registo](../../../artifacts/y-laboratory/build.txt).
- Smoke HTTP passou, incluindo os oito workers.
  [Resultado](../../../artifacts/y-laboratory/classroom-http.json).
- Learner-core e2e passou: partidas reais nos dois participantes × N1/N2,
  metas comparadas com os resultados, pista seguida de recarregamento,
  erro, três famílias autónomas, seis puzzles, XP idempotente, perfil numa
  nova sessão e preservação de dados/importação legada.
  [Registo](../../../artifacts/y-laboratory/learner-core.txt).

Os percursos Playwright ligam-se por `HUB_CDP_URL` ao browser gerido pelo
Agent Browser Hub, sessão `crjm35`, perfil `research`. Foram compilados
com `bun build <script> --target=node --packages=external --outdir=.tmp`
e executados com Node. A pasta temporária fica fora do commit.
A baseline de Atari Go regenerada pela suite foi reposta.

Sala de aula UI: passou nos três viewports, incluindo os seis jogos anteriores,
Faísca, Y, Arquivo e Laboratório. A nova verificação de Y cobre percurso,
diagrama de 93 nós, escolha pelo teclado, ausência de transbordo da página,
PT-PT/EN/NE × claro/escuro. [Resultado](../../../artifacts/y-laboratory/classroom-ui.json),
[captura no telemóvel](../../../artifacts/y-laboratory/mobile-ne.png) e
[captura de inspeção em computador](../../../artifacts/y-laboratory/desktop.png).
Original MCP: `/home/proteu/agent-browser-hub/screenshots/issue35-y-laboratory-desktop.png`.

O primeiro e2e detetou um seletor de teste que não considerava a marca decorativa
«Y» no botão. Foi corrigido; o percurso completo passou na repetição.
A sessão do Hub e o servidor local de inspeção foram encerrados no final.
