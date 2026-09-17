# Issue #38 — ativação do 11.º CRJM (2026/27)

Especificação: [#38](https://github.com/atilasos/crjm/issues/38), com
[#25](https://github.com/atilasos/crjm/issues/25). Base da implementação e da
revisão: `a18df16bbebb5274484e25873ef4e5cd6f65954d`.

## Dependências presentes no worktree

| Issue | Commit ancestral | Entrega |
| --- | --- | --- |
| #27 | `c28d9be` | Arquivo jogável, aprendizagem e progresso |
| #32 | `a39f01b` | Tutor e revisão de Faísca |
| #33 | `24ee4bf` | Tutor e revisão de Y |
| #34 | `e45e658` | Laboratório e persistência de Faísca |
| #35 | `1b1310a` | Laboratório e persistência de Y |
| #36 | `ff8828f` | Torneios online de Faísca |
| #37 | `a18df16` | Torneios online de Y |

Todos os commits foram confirmados com `git merge-base --is-ancestor`.
Os 60 testes focados das regras, IA local, adaptadores, servidor real e
serviços de progresso passaram antes da ativação (5541 verificações).
Os bloqueios técnicos estão resolvidos neste worktree. As sete issues
continuam abertas no GitHub; não se alterou o estado administrativo.

Os 13 ficheiros de entrada, incluindo CLAUDE.md, CONTEXT.md, a especificação,
a investigação e os três anexos, conservam os SHA-256 iniciais. Mantêm-se
no worktree, fora deste commit, conforme as entregas anteriores.

## Comportamento entregue

A seleção pública usa o catálogo partilhado: Dominório apenas no 1.º ciclo;
Faísca no 1.º/2.º; Quelhas no 1.º/2.º/3.º; Produto no 2.º/3.º/secundário;
Atari Go no 3.º/secundário; Y no secundário.

Início, Laboratório e criação de torneios, incluindo administração, apresentam
os seis jogos atuais por defeito. Gatos & Cães e Nex exigem a escolha explícita
de Arquivo. As ligações antigas continuam operacionais e regressam ao Arquivo.
O perfil apresenta os oito jogos; não há migração, reinício ou divisão do
progresso por edição. Faísca e Y deixam de exigir `?integracao=1`.

O início identifica a edição em PT-PT, inglês e nepalês. O README descreve a
seleção atual, o Arquivo e os oito jogos nos torneios. Os percursos existentes
de sala de aula, aprendizagem e persistência verificam agora as rotas públicas.

## Regras, tabuleiros e IA

- Faísca: os testes das regras e do adaptador reproduzem o exemplo oficial
  de vinte colocações, reservas e próxima casa; exercitam destinos inválidos,
  saltos, consumo e conclusão da partida. [Regras e testes](../../../src/games/faisca/logic.test.ts).
- Y: a [conferência do tabuleiro](../../design/y-board-validation.md) documenta
  93 intersecções e 252 ligações transcritas do DOCX. O SHA-256 do anexo
  continua `360be143cd44168cb10b7e071130c9e644b107e4cc1e24af5b1ad656f235c7fc`.
  Os testes verificam adjacências independentes, cantos, grupo único, troca
  e identidade do vencedor.
- As arenas existentes foram executadas em série nas entregas #30/#31,
  com 50 partidas por jogo, 25 aberturas emparelhadas, lados alternados e
  seed 3002026. N2 venceu 49–1 em Faísca e 50–0 em Y, sem jogadas ilegais.
  Nesta issue foram reproduzidas pelas regras públicas as 1086 ações de
  Faísca e 935 de Y: todas legais, com os mesmos resultados e emparelhamentos.
  [Evidência agregada e hashes dos originais](../../../artifacts/11crjm/issue-38/arenas.json).
  Os motores e as regras não foram alterados, nem se atribui força nova:
  orçamentos e latências são os medidos nas arenas originais.

## Standards

Revisão independente segundo `code-review`: zero violações documentadas ou
problemas materiais de desenho. Catálogo centralizado, vocabulário do domínio
e persistência centrada no aluno preservados.

## Spec

Revisão independente: zero requisitos incorretos ou desvios materiais no diff.
A seleção e os ciclos, o Arquivo, as ligações antigas e os consumidores do
catálogo correspondem à #38 e à especificação #25.

## Verificação

O teste de aceitação falhou primeiro com os seis jogos da edição anterior e
passou após a ativação. Um seletor ambíguo de Faísca no teste de browser foi
corrigido para identificar o contentor do jogo; não exigiu alteração das regras.
O percurso de progresso passou de 25 para 27 cartões esperados, pois Faísca e
Y ficam agora visíveis no perfil público. Os valores de XP e progresso legado
continuam a ser verificados sem alteração. A verificação visual de idiomas
continha um seletor antigo que confundia as duas ajudas do Laboratório
(prática estratégica e puzzle); foi delimitado ao artigo do puzzle. Este
problema do teste já existia na base `a18df16`, cujos dois controlos não foram
alterados nesta issue. O mesmo script foi alinhado com o feedback atual de
prática orientada e com o pedido explícito das três ajudas do tutor, em vez
de esperar automaticamente o texto de uma solução oculta.

Os percursos Playwright ligam-se por `HUB_CDP_URL` à sessão `issue38` do Agent
Browser Hub, perfil `research`. Usa-se Node para CDP, conforme as issues
anteriores: `bun build scripts/classroom-ui-smoke.ts scripts/e2e-learner-core-v1.ts
--target=node --packages=external --outdir=.tmp`, seguido de execução dos
bundles com Node. As bases de dados e servidores de verificação são temporários.

Os resultados finais constam de [validation.json](../../../artifacts/11crjm/issue-38/validation.json).


Gates finais:

| Verificação | Resultado |
| --- | --- |
| Suite completa | 576 passaram, zero falhas, 24030 verificações, 72 ficheiros |
| Sala de aula UI | 40 verificações agregadas; três viewports; oito jogos, Arquivo, Laboratório e torneios reais |
| Learner-core e2e | Passou; importação, XP, ajudas, revisão, prática e recuperação noutra sessão |
| Idiomas | 11 testes, 4336 verificações; percurso visual PT-PT/EN/NE nos dois temas passou |
| Build completo | Passou com Dominório, Quelhas, Produto, Atari Go e Nex em WASM |
| Smoke HTTP | Passou, incluindo os oito workers |
| TypeScript | 704 diagnósticos preexistentes antes e depois; zero novos após normalizar posições de linha |
| Revisão | Standards: 0 achados materiais; Spec: 0 achados materiais |

Capturas: [computador](../../../artifacts/11crjm/issue-38/home-desktop.png),
[tablet](../../../artifacts/11crjm/issue-38/home-tablet.png),
[telemóvel](../../../artifacts/11crjm/issue-38/home-mobile.png),
[Arquivo](../../../artifacts/11crjm/issue-38/archive-mobile.png) e
[nepalês no tema escuro](../../../artifacts/11crjm/issue-38/home-ne-mobile.png).
A captura adicional do MCP ficou em
`/home/proteu/agent-browser-hub/screenshots/issue38-home-desktop.png`.

A sessão do Hub e os servidores temporários foram encerrados. Os bundles de
verificação foram removidos. A baseline de Atari Go e as capturas anteriores
regeneradas pelos testes foram repostas para evitar alterações alheias à issue.
A entrega é local, pronta para revisão; não houve publicação em produção,
push, comentários ou alterações às issues #25/#38 ou às suas dependências.
