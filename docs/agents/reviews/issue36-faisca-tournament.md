# Issue #36 — Torneios online de Faísca

Data: 2026-09-17. Âmbito: [issue #36](https://github.com/atilasos/crjm/issues/36),
com a especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `1b1310a`.

## Dependência e âmbito

A dependência técnica #28 está presente neste worktree: o commit `0a7b6f8`
é ancestral de HEAD e contém as regras públicas, a partida local e a
persistência. Antes da implementação passaram os 17 testes das regras de
Faísca e do serviço de progresso, com 196 verificações. A issue #28 continua
aberta no GitHub e registada como bloqueio administrativo; não foi alterada.

Apenas Faísca recebe a capacidade `tournament`. A seleção permanece em
integração (`?integracao=1#/campeonato` e `/admin?integracao=1`); a ativação
pública da edição pertence a #38 e os torneios de Y a #37. Os documentos e
anexos preexistentes, incluindo CLAUDE.md e os ficheiros não versionados de
contexto, especificação e investigação, ficam preservados fora deste commit.

## Implementação

- Ações de rede com casa, distância e direção, validadas estruturalmente
  antes de usar exatamente as regras públicas locais. O estado completo
  mantém tabuleiro, reservas, casa obrigatória, turno e resultado.
- Servidor valida identidade, partida, turno, número da partida, pausa e
  legalidade. Uma ação repetida não pode reutilizar a casa já ocupada,
  mesmo quando volta a ser a vez do seu autor.
- Tabuleiro extraído e partilhado entre modo local, participantes,
  participantes em espera e espectador da administração. Controlos por
  teclado, coordenadas, direções, distância, símbolos e reservas nos temas
  e idiomas existentes, sem importar IA ou Laboratório no percurso online.
- Recuperação da partida ativa também quando uma nova ligação substitui
  outra ainda aberta. O fecho da ligação substituída não suspende a nova.
- Emissão do tabuleiro final aos espectadores antes de o servidor passar
  à partida seguinte, com resultado e pontuação consistentes.
- Seletor e textos de idioma no espectador, seleção de partidas sem
  capturar uma seleção antiga e cancelamento de reconexões ao desmontar.
- Mantêm-se a dupla eliminação, a alternância de papéis, a administração,
  exportação/importação e os seis jogos anteriores, sem migração de dados.

## Standards

Revisão independente segundo `code-review`: zero violações documentadas.
Uma observação heurística não bloqueante: quatro linhas semelhantes na
aplicação de ações entre mock e adaptador. Mantidas por seguirem o padrão
existente; não se introduziu uma refatoração transversal dos restantes jogos.
Revalidação final sem novos problemas bloqueantes.

## Spec

Revisão independente: dois achados iniciais corrigidos — recuperação da
partida numa reconexão sobreposta e textos incompletos do espectador.
Revalidação: zero achados pendentes. O teste WebSocket inclui a substituição
da ligação antes de esperar pelo seu fecho.

## Verificação

- TDD no adaptador: primeiro teste falhou por Faísca ainda não estar
  suportada; passou após a integração. A sequência oficial de vinte peças
  e a continuação até à vitória de Vermelho são comparadas entre modo
  local, adaptador e serialização. Entradas inválidas preservam o estado.
- Servidor real isolado: quatro participantes, espectador autenticado,
  jogador alheio, turno/número/ação inválidos, pausa, reconexão, substituição
  da ligação, repetição, conclusão de todas as partidas de dupla eliminação
  e exportação/importação pela API pública.
- Browser real do Agent Browser Hub, sessão `issue36`, perfil `research`:
  professor cria Faísca, dois alunos entram por código, jogam o exemplo
  completo, um reconecta e o espectador recebe o resultado. A partida
  seguinte confirma a troca de papéis. Percurso em 1440, 1024 e 390 px,
  PT-PT/EN/NE e claro/escuro, com teclado, controlos e ausência de transbordo.
- A regressão learner-core detetou uma colisão de chaves React entre o
  tabuleiro extraído e a revisão. Corrigida com uma chave distinta; o
  percurso completo passou, incluindo IA local, revisão, XP, importação
  legada e recuperação de progresso noutra sessão.
- Suite completa: 569 testes passaram, zero falhas, 72 ficheiros e 20771
  verificações. A baseline regenerada de Atari Go foi reposta.
- Sala de aula UI: passou nos três viewports, 38 verificações agregadas,
  incluindo seis jogos anteriores, Faísca, Y, Arquivo e Laboratório.
- TypeScript: 704 diagnósticos preexistentes antes e depois, sem novos
  diagnósticos após normalizar posições de linha.
- Build completo passou com os cinco WASM. Verificação de idiomas passou:
  11 testes, 4336 verificações. Smoke HTTP passou com oito workers.

Os percursos Playwright ligaram-se por `HUB_CDP_URL` ao browser do Hub.
Como no trabalho anterior, os scripts foram compilados com
`bun build <script> --target=node --packages=external --outdir=.tmp`
e executados com Node. O arranque da competição usa a API pública de
administração, como no teste existente dos jogos arquivados.

Artefactos em [artifacts/faisca-tournament](../../../artifacts/faisca-tournament/),
incluindo [captura do espectador em telemóvel](../../../artifacts/faisca-tournament/spectator-390.png).

A sessão do Hub foi encerrada no final. Os servidores temporários e os
ficheiros de compilação de teste foram removidos.
