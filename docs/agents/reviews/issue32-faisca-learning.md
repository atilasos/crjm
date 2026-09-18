# Issue #32 — ajuda gradual e revisão de Faísca

Data: 2026-09-17. Âmbito: [#32](https://github.com/atilasos/crjm/issues/32),
especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `3ccd15b7189193f93e196c7cc4b960e2c0f4a0b2`.

## Dependência e âmbito

A #30 continua aberta e registada como bloqueio no GitHub. A dependência
**técnica** está satisfeita: `dc07afb` integra a IA local de Faísca neste
worktree e os 11 testes de regras, IA e catálogo passaram antes da alteração.
Não foi alterado o estado das issues no GitHub.

Faísca mantém-se na pré-visualização `?integracao=1#/faisca`. Foram acrescentadas
apenas as capacidades tutor e revisão. Não foram acrescentados percursos,
puzzles, treino estratégico separado nem torneios. Os documentos e anexos
preexistentes, incluindo os não versionados, foram preservados fora do commit.

## Comportamento

- Tutor existente com três pedidos explícitos: princípio, comparação e
  exemplo. Apenas o exemplo revela uma jogada concreta; o tabuleiro conserva
  a indicação pública da casa obrigatória e a pré-visualização da escolha do aluno.
- O pedido de ajuda persiste `used_with_help` pelo mecanismo de padrões
  antes de revelar a pista. A exposição mantém-se entre sessões; este
  percurso nunca regista `used_alone` nem domínio autónomo.
- O exemplo usa o motor local no worker e as regras públicas validam a jogada,
  o destino, as reservas restantes e o número de respostas legais. A indicação
  de incerteza usa linguagem concreta: a pista não garante vitória.
- Turno, reinício, modo e lado novos desmontam o tutor anterior e cancelam
  exemplos pendentes. Uma confirmação de ajuda atrasada não revela pistas no
  turno seguinte.
- A revisão conserva em memória a última decisão humana com alternativas
  (ou a primeira decisão se não houve escolha), a posição e as reservas.
  Compara a jogada realizada com uma alternativa legal selecionada por
  mobilidade imediata, sem apresentar essa estimativa como prova de vitória.
- O comando existente de revisão aceita um contexto opcional. O identificador
  do evento inclui aluno, jogo e contexto, impedindo recompensa duplicada
  quando a confirmação se perde e o aluno volta a tentar. Não há novas tabelas
  nem persistência de tabuleiros ou histórico de partidas.
- Textos PT-PT/EN/NE, temas existentes, células da revisão nomeadas para leitores
  de ecrã e novos controlos com alvos mínimos de 48 px. O novo cartão só aparece
  no perfil quando Faísca está visível no catálogo.

## Revisão independente

**Standards:** corrigidos dois achados: semântica acessível das células da
revisão e linguagem demasiado abstrata. Reavaliação: nenhum problema bloqueante.
Permanece apenas uma observação não bloqueante sobre a pequena duplicação de
formatação de coordenadas/direções entre o tabuleiro e a revisão.

**Spec:** zero achados de implementação. O pedido de evidência adicional para
respostas atrasadas foi incorporado no percurso de sala de aula.

## Verificação

- [Suite completa](../../../artifacts/faisca-learning/tests.txt): **552 testes,
  zero falhas**, 71 ficheiros; 53,80 s. O baseline de Atari Go regenerado pelos
  testes foi reposto e o artefacto transitório removido.
- [TypeScript](../../../artifacts/faisca-learning/typecheck.json): **704
  diagnósticos preexistentes antes e depois**, nenhum novo por ficheiro/código.
- [Build completo](../../../artifacts/faisca-learning/build-full.txt): cinco
  WASM, paridade de 1658 mensagens por idioma e nove testes de tradução.
- [Smoke HTTP](../../../artifacts/faisca-learning/classroom-http.json): passou.
- [Learner-core e2e](../../../artifacts/faisca-learning/e2e.txt): passou,
  incluindo importação legada, preservação dos jogos anteriores, ajuda após
  recarregamento e nova sessão, revisão e repetição após resposta HTTP perdida.
  A posição real do turno 22 é verificada: a3 → a1 termina a partida; a
  alternativa a3 → d3 permite três respostas legais.

Uma execução e2e intermédia falhou na IA de Y durante verificações concorrentes.
A repetição serial passou sem alteração ao código de Y; não se atribui uma
causa definitiva a essa falha transitória.

Os percursos de browser usam uma sessão do Agent Browser Hub, perfil
`research`, através de `HUB_CDP_URL`. Nesta máquina, os scripts com imports
TypeScript são agrupados com `bun build --target=node --packages=external`
para `.tmp/issue32-e2e.mjs` e `.tmp/issue32-classroom.mjs`, antes de executar
com Node. A suite de Bun foi executada apenas uma vez no fim da implementação.

- [Sala de aula UI](../../../artifacts/faisca-learning/classroom-ui.json): passou
  nos três viewports, incluindo os seis jogos anteriores, Y, Arquivo e
  Laboratório. Faísca cobre tutor e revisão de uma partida completa em
  **PT-PT/EN/NE × claro/escuro × computador/tablet/telemóvel**, atrasos de
  confirmação da ajuda e do worker em mudança de turno/reinício, controlos
  acessíveis e ausência de overflow. [Captura no telemóvel](../../../artifacts/faisca-learning/mobile.png),
  inspecionada visualmente. A sessão do Hub foi fechada no fim.
