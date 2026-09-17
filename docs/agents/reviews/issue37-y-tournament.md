# Issue #37: torneios online de Y

Data: 2026-09-17. Especificação: [#37](https://github.com/atilasos/crjm/issues/37),
com a especificação principal [#25](https://github.com/atilasos/crjm/issues/25).
Base da implementação e revisão: `ff8828ff3da0c323d7a1e550b992ac277e589ca2`.

## Dependência e âmbito

O commit `f2d3155`, da dependência #29, é ancestral de HEAD. Estão presentes
as regras públicas, o tabuleiro validado de 93 intersecções e 252 ligações,
a partida local e a persistência. Os 19 testes de regras de Y e do serviço
de progresso passaram antes da implementação, com 237 verificações.
A issue #29 continua aberta no GitHub; o bloqueio técnico está resolvido
neste worktree, mas o estado administrativo não foi alterado.

Apenas a capacidade `tournament` de Y é acrescentada ao catálogo. O percurso
continua na pré-visualização `?integracao=1#/campeonato` e
`/admin?integracao=1`. A publicação da seleção atual pertence a #38.
Os documentos e anexos de entrada, incluindo CLAUDE.md, foram conferidos por
SHA-256 e permanecem inalterados, fora deste commit.

## Implementação

O adaptador de torneios aplica as mesmas ações públicas de colocação e troca
do modo local. O protocolo transporta o estado completo e valida as ações
recebidas. A troca mantém a peça inicial e a identidade dos participantes;
a atribuição das cores, o turno e o vencedor seguem as regras locais.

O cliente real, o cliente de demonstração, os participantes em espera e o
espectador da administração apresentam Y através do tabuleiro validado.
Os nomes acompanham as cores atuais, respeitando também a alternância de
quem começa entre partidas. Os textos reutilizam os catálogos PT-PT, inglês
e nepalês. Mantêm-se os temas, os símbolos das peças, o teclado e os alvos
mínimos de 44 px definidos na documentação específica de Y.

A reconexão devolve o tabuleiro mesmo quando o adversário ainda está
desligado. Os controles ficam desativados durante essa pausa. As listas do
espectador identificam o jogo a que cada atualização pertence, conservando
torneios simultâneos. A seleção inicial respeita o jogo pedido no URL e o
tipo do tabuleiro é sempre obtido do próprio snapshot.

Não há migração de dados nem alterações à IA ou ao Laboratório. Os motores
e as regras dos seis jogos anteriores são preservados.

## Standards

A revisão independente identificou a resposta HTTP do percurso de browser
sem validação explícita. Corrigida para receber `unknown` e validar os
participantes antes de os utilizar. Revalidação sem violações materiais.

Duas sugestões heurísticas não bloqueantes foram mantidas como observações:
partilhar as poucas linhas de adaptação entre servidor e demonstração;
partilhar as sequências literais de vitória entre testes. Mantiveram-se o
padrão dos adaptadores existentes e as expectativas independentes dos testes,
sem introduzir uma refatoração transversal.

## Spec

A revisão independente detetou a falta do snapshot quando ambos os alunos
estavam desligados. Um teste WebSocket reproduziu a falha antes da correção.
O servidor passou a enviar o estado pausado; testes de servidor e browser
confirmam a recuperação e a recusa de jogadas até o adversário regressar.

A regressão conjunta detetou seleção inicial de um jogo diferente do pedido.
A revisão subsequente identificou uma combinação transitória entre o jogo
selecionado e o snapshot anterior ao alternar entre Y e Faísca. Corrigidos
através da seleção por jogo, listas por torneio e remoção do estado redundante.
A revalidação da revisão terminou sem achados pendentes.

## Verificação

Os resultados finais e os percursos executados estão em
[validation.json](../../../artifacts/y-tournament/validation.json).
As capturas mostram o vencedor após troca em
[computador](../../../artifacts/y-tournament/spectator-1440.png),
[tablet](../../../artifacts/y-tournament/spectator-1024.png) e
[telemóvel](../../../artifacts/y-tournament/spectator-390.png).

As verificações de browser usam a sessão `issue37` do Agent Browser Hub,
perfil `research`, através de `HUB_CDP_URL`. Os scripts existentes foram
compilados com `bun build --target=node --packages=external --outdir=.tmp`
e executados com Node, seguindo o procedimento das issues anteriores.


Gates finais: 576 testes passaram, zero falhas, 24030 verificações em 72
ficheiros. Sala de aula: 39 verificações agregadas, mais a repetição final
dos torneios e da alternância Y/Faísca. Learner-core e2e, idiomas e build
completo com os cinco WASM passaram. O TypeScript mantém os 704 diagnósticos
preexistentes, sem novos diagnósticos após normalizar as posições de linha
e o nome do teste de torneios.

A sessão do Hub foi encerrada. Os servidores e ficheiros temporários foram
removidos; as baselines e capturas dos outros jogos foram repostas.
