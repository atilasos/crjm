# Issue #33 — ajuda gradual e revisão de Y

Data: 2026-09-17. Âmbito: [#33](https://github.com/atilasos/crjm/issues/33),
especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `a39f01bf3a1beb194f1299a18b19d618086e8597`.

## Dependência e âmbito

A #31 continua aberta e indicada como bloqueio no GitHub. A dependência
**técnica** está satisfeita: `3ccd15b` integra neste worktree a IA local de Y,
a troca entre participantes e os níveis avaliados. As regras e o grafo
validado de #29 (`f2d3155`) também estão presentes. Os 14 testes existentes
relevantes de regras, motor e catálogo passaram antes da implementação.
Não foi alterado o estado administrativo das issues.

Y mantém-se na pré-visualização `?integracao=1#/y`, acrescentando apenas tutor
e revisão. Os documentos e anexos preexistentes, incluindo as alterações
locais e os documentos não versionados, ficam preservados fora deste commit.

## Comportamento

- Três pedidos explícitos pelo tutor existente: princípio, comparação e
  exemplo. Só o terceiro revela uma ação concreta e os grupos/lados ligados.
- A exposição à ajuda é confirmada pelo mecanismo de progresso existente
  antes da revelação. O padrão `y:tres-lados` conserva `used_with_help` entre
  sessões. Não é produzida evidência `used_alone` nem domínio autónomo.
- O tutor pertence ao participante associado ao perfil, também nas partidas
  locais. A troca altera a cor, mantendo a identidade. O identificador do
  turno inclui a ação de troca, embora esta não coloque uma peça.
- O motor local calcula exemplos num worker cancelável. A legalidade e as
  consequências são verificadas pelas regras públicas. O cálculo do grupo
  usa as ligações do grafo já validado, partilhado com a deteção de vitória.
- A revisão conserva em memória a última decisão do aluno com alternativas
  (ou a primeira quando não houve escolha), a posição, participante, cores e
  número do turno. Apresenta a ação realizada, os lados efetivamente ligados
  por um único grupo e a recomendação do motor para essa posição.
- A vitória imediata demonstrada pelas regras distingue-se da estimativa de
  ligações futuras. A vitória do adversário não é atribuída à decisão do aluno.
- A posição anterior usa o mesmo desenho do tabuleiro, com nomes acessíveis
  para as intersecções, sem permitir novas jogadas na revisão.
- A revisão reutiliza o comando idempotente existente com o identificador da
  partida. Uma confirmação HTTP perdida não duplica os 10 XP da revisão.
  Não há novas tabelas nem persistência de tabuleiros/histórico de partidas.
- Textos PT-PT/EN/NE e temas existentes. O cartão do padrão só aparece no perfil
  quando Y está visível no catálogo.

## Standards

Sem violações documentadas nem problemas de correção identificados. A revisão
independente confirmou o núcleo de persistência existente, a identidade após
troca, a separação entre recomendação e consequência e a acessibilidade.

Uma observação de manutenção não bloqueante: o controlo assíncrono de
persistência em `YLearning.tsx` repete o precedente de `FaiscaLearning.tsx`.
Uma extração partilhada pode ser considerada quando esse contrato mudar;
foi preservado o âmbito desta issue. **0 violações; 1 observação não bloqueante.**

## Spec

Sem requisitos ausentes, desvios de âmbito ou implementação incorreta
identificados na revisão independente. **0 achados.**

## Verificação

- TDD: o teste público de progresso falhou inicialmente por não conservar o
  padrão de Y e passou após a integração. O percurso de tutor falhou antes da
  implementação e passou depois, sem depender de funções privadas.
- [Suite completa](../../../artifacts/y-learning/tests.txt): **553 testes,
  zero falhas**, 71 ficheiros, 53,82 s. Executada uma vez no fim. O baseline
  regenerado de Atari Go foi reposto e a cópia transitória removida.
- [TypeScript](../../../artifacts/y-learning/typecheck.json): **704 diagnósticos
  preexistentes**, sem novos por ficheiro/código.
- [Build completo](../../../artifacts/y-learning/build-full.txt): cinco WASM,
  verificação de idiomas e nove testes de tradução passaram.
- [Smoke HTTP](../../../artifacts/y-learning/classroom-http.json): passou,
  incluindo os oito workers.
- [Learner-core e2e](../../../artifacts/y-learning/e2e.txt): passou. Inclui ajuda
  gradual, recarregamento, revisão do turno 26 do Jogador 2 com Azul após troca,
  vitória verificada pelo grupo A1–A9, confirmação perdida/repetição sem XP
  duplicado, nova sessão, importação legada e preservação dos outros jogos.
  A expectativa de XP foi atualizada para incluir os 3 XP de prática do padrão,
  atribuídos pelo mecanismo existente no primeiro pedido de ajuda.

Os percursos Playwright usam a sessão `crjm33` do Agent Browser Hub, perfil
`research`, via `HUB_CDP_URL`. Os scripts com imports TypeScript são compilados
com `bun build --target=node --packages=external` para `.tmp/issue33-e2e.mjs`
e `.tmp/issue33-classroom.mjs`, e executados com Node. Os gates que exercitam
motores são executados em série.

- [Sala de aula UI](../../../artifacts/y-learning/classroom-ui.json): passou
  nos três viewports, incluindo os seis jogos anteriores, Faísca, Arquivo e
  Laboratório. Y cobre tutor e revisão em **PT-PT/EN/NE × claro/escuro ×
  computador/tablet/telemóvel**, controlo por teclado, ausência de overflow,
  revisão dos dois participantes com e sem troca, confirmação atrasada da ajuda
  e resposta atrasada do worker ao mudar turno, reiniciar, trocar cores, mudar
  modo, participante ou nível.
- [Captura no telemóvel](../../../artifacts/y-learning/mobile.png): inspecionada
  visualmente. Mostra a decisão real do Jogador 2 com Azul após a troca, o grupo
  vencedor e a recomendação separada. A sessão do Hub foi fechada no fim.
