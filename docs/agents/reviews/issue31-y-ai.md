# Issue #31 — treino de Y com IA local

Data: 2026-09-17. Âmbito: [issue #31](https://github.com/atilasos/crjm/issues/31),
com a especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `dc07afb` (commit inicial do worktree).

## Dependências e âmbito

A dependência técnica #29 está satisfeita pelo commit `f2d3155`, presente
neste worktree, com o catálogo de #26 (`6d991d8`) como antecessor. Os 11 testes
das regras de Y e do catálogo passaram antes da implementação. A issue #29
continuava aberta no GitHub; não foi alterado o seu estado administrativo.
O grafo de 93 nós e 252 ligações é o já conferido contra o DOCX original,
conforme [validação do tabuleiro](../../design/y-board-validation.md).

Y continua acessível pela pré-visualização `?integracao=1#/y`. Esta entrega
acrescenta apenas a capacidade de IA; não ativa a edição, tutor, percursos ou
torneios. Os documentos e anexos preexistentes, incluindo as alterações locais
em CLAUDE.md e os documentos ainda não versionados, ficam preservados e fora
deste commit.

## Implementação

- Ações públicas de colocação e troca partilhadas pela interface, motor e arena.
- Motor TypeScript local, AIResponse v1, executado num worker por pedido.
  Reiniciar, mudar modo/participante/nível ou sair termina o worker e invalida
  a resposta. Falhas apresentam recuperação explícita.
- N1 Explorar: escolha legal aleatória com seed. N2 Antecipar: avaliação do
  custo de ligar os três lados no grafo oficial, com avaliação da posição
  adversária e deteção de vitória pelas regras públicas. A avaliação é
  heurística; não prova jogo perfeito nem equivalência com outros jogos.
- Humano e computador podem assumir qualquer participante e trocar de cores.
  A identidade permanece independente da cor. O comando existente
  `recordGameCompleted` recebe a vitória do participante do aluno e o nível.
- Seletor de dificuldade existente, textos PT-PT/EN/NE, símbolos além das cores,
  temas existentes e controles com nomes acessíveis.

## Evidência das dificuldades

Arena executada isoladamente: `bun run scripts/y-arena.ts`.
[Registo completo](../../../artifacts/y-arena/seed-3002026.json): seed
**3002026**, **50 partidas**, **25 aberturas emparelhadas**, alternância de
participantes, Bun 1.3.14, orçamentos N1 **5 ms** e N2 **120 ms**.

N2 venceu **50–0**, com **zero jogadas ilegais**. O artefacto conserva aberturas,
ações, resultados e amostras de latência. A revisão independente reproduziu
as **935 ações** pelas regras públicas e confirmou os vencedores.
Latência N2: mediana **6,36 ms**, p95 **6,95 ms**, máximo **18,29 ms**.
N1: p95 **0,011 ms**. Esta avaliação sustenta a progressão destes dois níveis
nesta configuração; não estabelece um nível competitivo externo.

## Revisão

Revisões independentes, conforme a skill `code-review`, comparando as alterações
pendentes com a base inicial antes do commit:

### Standards

Sem violações documentadas, bugs materiais ou problemas de desenho que
justifiquem alterações neste âmbito. Confirmados cancelamento, identidade
após troca, uso das regras públicas, persistência e integração limitada.
**0 achados.**

### Spec

Sem requisitos ausentes, desvios ou expansão de âmbito identificados.
Replay independente confirmou as 50 partidas, emparelhamento, ações legais e
resultados. **0 achados.**

## Verificação

- Suite completa: **551 testes passaram**, zero falhas, 71 ficheiros.
  [Registo](../../../artifacts/y-ai/tests.txt).
- Testes focados: 14 testes das regras, motor e catálogo passaram.
- TypeScript: **704 diagnósticos antes e depois**, sem novos diagnósticos por
  ficheiro/código. [Comparação](../../../artifacts/y-ai/typecheck.json).
- Build completo com os cinco WASM e verificação de idiomas passou.
  [Registo](../../../artifacts/y-ai/build.txt). Depois de tornar explícito o
  nome acessível do seletor de participante, o build JS/idiomas voltou a passar.
- Smoke HTTP passou, incluindo os oito workers.
  [Resultado](../../../artifacts/y-ai/classroom-http.json).
- Learner-core e2e passou: quatro partidas de Y contra IA (dois participantes ×
  dois níveis), resultado observado comparado com regras e progresso por nível,
  preservação dos outros jogos, nova sessão e importação legada idempotente.
  [Resultado](../../../artifacts/y-ai/learner-core.txt).
- Sala de aula UI passou nos três viewports, nos seis jogos anteriores,
  Faísca, Arquivo e Laboratório. Y cobre PT-PT/EN/NE × claro/escuro, teclado,
  troca pelo computador e humano, quatro partidas locais com resultado no
  perfil, cancelamento ao reiniciar/mudar lado ou nível/sair e recuperação
  após falha do worker. [Resultado](../../../artifacts/y-ai/classroom-ui.json)
  e [captura no telemóvel](../../../artifacts/y-ai/mobile.png).

Os percursos Playwright usaram a sessão `crjm31` do Agent Browser Hub, perfil
`research`, via `HUB_CDP_URL`, com Node, conforme o precedente da issue #30.
O e2e com imports TypeScript foi compilado temporariamente com
`bun build scripts/e2e-learner-core-v1.ts --target=node --packages=external`.
A sessão foi fechada no final. O artefacto regenerado da baseline de Atari Go
foi reposto e a cópia datada produzida pela suite foi removida para evitar
incluir ruído de medições alheias a esta issue.
