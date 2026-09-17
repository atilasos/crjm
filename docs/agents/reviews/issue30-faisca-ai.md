# Issue #30 — treino de Faísca com IA local

Data: 2026-09-17. Âmbito: [issue #30](https://github.com/atilasos/crjm/issues/30),
com a especificação [#25](https://github.com/atilasos/crjm/issues/25).
Base da revisão: `f2d31550425a3b891085a6293df1e50bf61b9073`.

## Dependências e âmbito

O worktree contém `6d991d8` (#26, catálogo) e `0a7b6f8` (#28, Faísca local
e progresso). Os nove testes das regras e do catálogo passaram antes da
implementação. A issue #28 ainda estava aberta no GitHub; a dependência
técnica está satisfeita pelos commits e pelo comportamento observado.

A IA continua acessível pela pré-visualização `?integracao=1#/faisca`.
Esta entrega não ativa a nova edição nem acrescenta tutor, percursos ou
torneios de Faísca. Os documentos e anexos já presentes no worktree foram
preservados, incluindo os ficheiros locais ainda não versionados.

## Implementação

- Regras públicas de Faísca partilhadas pela UI, motor e arena.
- Pedidos/respostas AIResponse v1 num worker local TypeScript. Cada pedido
  termina o seu worker quando é concluído, cancelado ou falha. Reiniciar,
  mudar modo/lado/nível ou sair invalida a resposta anterior.
- Dois níveis próprios: N1 Explorar (escolhas legais aleatórias com seed),
  N2 Antecipar (negamax com aprofundamento iterativo e orçamento de 120 ms).
  Níveis de Faísca não implicam equivalência com outros jogos.
- Azul ou Vermelho para o aluno; resultados e dificuldade passam pelo
  comando existente `recordGameCompleted`. O modo local conserva o registo
  de prática sem atribuir vitória contra o computador.
- Textos PT-PT/EN/NE, seletor existente de dificuldade com perfis próprios,
  controles acessíveis e recuperação explícita quando o worker falha.

## Evidência de dificuldade

Executado isoladamente: `bun run scripts/faisca-arena.ts`.
[Artefacto completo](../../../artifacts/faisca-arena/seed-3002026.json):
seed **3002026**, **50 partidas**, 25 aberturas emparelhadas e lados alternados,
orçamentos N1 **5 ms** e N2 **120 ms**, Bun 1.3.14.

N2 venceu **49–1**, com **zero jogadas ilegais**. A revisão independente
reproduziu todas as partidas pelas regras públicas e confirmou os resultados.
Latência N2: mediana **30,82 ms**, p95 **120,02 ms**, máximo **120,26 ms**.
N1: p95 **0,012 ms**. O artefacto contém amostras, aberturas e jogadas.
O resultado sustenta a ordenação destes dois níveis nesta configuração;
não constitui uma promessa de jogo perfeito ou de força entre jogos.

## Revisão

**Standards:** dois achados iniciais corrigidos: `criticalThreats: []`
obrigatório no contrato e indicação «A pensar…» após falha do worker.
Revisão posterior: **zero problemas pendentes**.

**Spec:** **zero achados**; sem alargamento às outras issues da edição.

## Verificação

- Suite completa: **548 testes passaram**, zero falhas, 70 ficheiros.
  [Registo](../../../artifacts/faisca-ai/tests.txt).
- Após os ajustes de revisão, os 11 testes focados de Faísca e catálogo passaram.
- TypeScript: **704 diagnósticos antes e depois**, sem novos diagnósticos por
  ficheiro/código. [Comparação](../../../artifacts/faisca-ai/typecheck.json).
- Build completo com os cinco WASM: passou, incluindo idiomas (1636 mensagens
  em cada catálogo, paridade e placeholders) e os testes de tradução.
- Smoke HTTP: passou, incluindo os sete workers.
  [Resultado](../../../artifacts/faisca-ai/classroom-http.json).
- Learner-core e2e: quatro partidas contra IA (dois lados × dois níveis),
  resultado observado comparado com progresso por nível, preservação dos
  outros jogos, nova sessão e importação legada idempotente.
  [Resultado](../../../artifacts/faisca-ai/learner-core.txt).
- Sala de aula UI: passou nos três viewports, nos seis jogos anteriores,
  Arquivo, Y e Laboratório. Faísca cobre PT-PT/EN/NE × claro/escuro,
  controles, abertura da IA como Azul, reinício/saída com resposta atrasada
  e recuperação após falha do worker.
  [Resultado](../../../artifacts/faisca-ai/classroom-ui.json) e
  [captura no telemóvel](../../../artifacts/faisca-ai/mobile.png).

Os testes de browser utilizam o Agent Browser Hub, perfil `research`, via
`HUB_CDP_URL`. A ligação CDP do Playwright sob Bun sofreu timeout; o mesmo
percurso foi executado com Node. Para o e2e com imports TypeScript, gerar
um bundle Node em `.tmp/` com `bun build scripts/e2e-learner-core-v1.ts
--target=node --packages=external --outfile=.tmp/issue30-e2e.mjs` e executá-lo
com `HUB_CDP_URL=<CDP da sessão Hub> node .tmp/issue30-e2e.mjs`.

A primeira sessão, ligada também ao Browser Use para inspeção, apresentou
intermitência na aceitação do diálogo de criação de torneios do teste existente.
Uma sessão nova do Hub, controlada pelo percurso Playwright, completou todo o
gate sem alterar esse teste nem a administração. As sessões foram fechadas no
final. O artefacto de baseline regenerado pela suite foi reposto para evitar
incluir ruído de timestamps/latências de Atari Go.
