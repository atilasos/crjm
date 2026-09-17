# Issue #34 — Laboratório de Faísca

Data: 2026-09-17. Âmbito: [issue #34](https://github.com/atilasos/crjm/issues/34),
com a especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `24ee4bf91d40e7923b6387f6b62819e58fdcc9a2`.

## Dependência e âmbito

O commit `dc07afb` (#30) é ancestral de HEAD e as regras, worker, dois níveis
locais e progresso por dificuldade estão presentes. Os 11 testes de Faísca e
catálogo passaram na verificação inicial. A [arena registada](../../../artifacts/faisca-arena/seed-3002026.json)
contém 50 partidas, seed e zero jogadas ilegais; não foi repetido o benchmark.
A issue #30 continua aberta no GitHub: a dependência técnica está satisfeita,
mas o estado administrativo não foi alterado.

Faísca ganha as capacidades `puzzles`, `training` e `strategy`, acessíveis em
`?integracao=1#/puzzles`. A ativação pública da edição continua reservada à
issue #38. Esta entrega não acrescenta aprendizagem de Y nem torneios.
Os documentos e anexos preexistentes, incluindo os ainda não versionados,
foram preservados fora deste commit.

## Implementação e evidência pedagógica

- Quatro etapas existentes, seis puzzles de prática orientada e metas
  verificadas pelo progresso real de partidas nos níveis N1/N2.
- 24 situações de escolha e previsão: seis famílias (abertura, casa
  obrigatória, salto, destino ocupado, inventário e final) com quatro
  reflexões. As reflexões não criam famílias novas.
- As posições são prefixos legais do exemplo do regulamento, com a
  continuação b3 → a3 para o final. A legalidade e as consequências são
  calculadas pelas ações públicas das regras de Faísca.
- Serviço persistente existente, sem migração: respostas, pistas, primeira
  resposta imutável, elegibilidade por situação e recuperação após 24 horas.
  Os puzzles com explicação continuam sempre como prática orientada.
- Textos PT-PT/EN/NE; componentes existentes de tema, teclado, acessibilidade
  e perfil. O catálogo anterior de puzzles mantém a sua ordem.

## Revisão

**Standards:** um achado inicial de vocabulário corrigido: «partidas» na
meta de N2. Revalidação independente: **zero achados pendentes**.

**Spec:** **zero achados**. A revisão verificou o âmbito, as seis famílias,
as ações públicas, a persistência e as metas dos dois níveis locais.

## Verificação

- Suite completa: **559 passaram, zero falhas**, 71 ficheiros.
  [Registo](../../../artifacts/faisca-laboratory/tests.txt).
- Verificação focada: **38 passaram**, incluindo aprendizagem, percursos,
  catálogo e traduções. [Registo](../../../artifacts/faisca-laboratory/focused.txt).
- TypeScript: **704 diagnósticos anteriores e posteriores**, sem novos
  diagnósticos após normalizar posições de linha.
  [Comparação](../../../artifacts/faisca-laboratory/typecheck.json).
- Build completo com os cinco WASM e verificação de idiomas: passou;
  **1778 mensagens** em cada catálogo, com paridade e placeholders.
  [Build](../../../artifacts/faisca-laboratory/build.txt).
- Smoke HTTP: passou. [Resultado](../../../artifacts/faisca-laboratory/classroom-http.json).
- Learner-core e2e: passou com partidas reais nos dois lados × N1/N2,
  metas comparadas com os resultados, pista seguida de recarregamento,
  erro, três famílias autónomas, seis puzzles, XP e conquistas idempotentes,
  perfil numa nova sessão, dados anteriores e importação legada preservados.
  [Resultado](../../../artifacts/faisca-laboratory/learner-core.txt).

- Sala de aula UI: passou nos três viewports, seis jogos anteriores, Y,
  Faísca, Arquivo e Laboratório. O Laboratório de Faísca cobre PT-PT/EN/NE
  × claro/escuro, escolha pelo teclado, percurso e ausência de transbordo.
  [Resultado](../../../artifacts/faisca-laboratory/classroom-ui.json) e
  [captura no telemóvel em nepalês](../../../artifacts/faisca-laboratory/mobile-ne.png).

A primeira execução de sala de aula parou no teste existente de cancelamento
de pistas de Y enquanto o Hub era partilhado com inspeção. Uma nova sessão
exclusiva completou o gate sem alterações ao código de Y ou a esse teste.
Ambas as sessões do Hub foram fechadas no final.

Captura de inspeção pelo MCP do Hub: [Laboratório](../../../artifacts/faisca-laboratory/desktop.png).
Original: `/home/proteu/agent-browser-hub/screenshots/issue34-faisca-laboratory-desktop.png`.

Os percursos Playwright ligam-se por `HUB_CDP_URL` ao browser gerido pelo
Agent Browser Hub, perfil `research`. Para executar com Node e resolver os
imports TypeScript, gerar bundles com `bun build <script> --target=node
--packages=external --outfile=.tmp/<nome>.mjs`. A pasta `.tmp` fica fora do
commit. A baseline de Atari Go regenerada pela suite foi reposta.
