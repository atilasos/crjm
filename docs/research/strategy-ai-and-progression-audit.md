# Auditoria da IA e da progressão estratégica

Data: 2026-09-15. Estado observado no início da investigação, sobre `65b4949` com alterações locais anteriores. Esta nota descreve a situação encontrada; as correções feitas na branch `learning/strategy-first` devem ser lidas como resposta a este diagnóstico.

## Decisão recomendada

A primeira melhoria deve mudar a forma de pedir ajuda e de reconhecer aprendizagem. Os motores já permitem criar desafios úteis. A aplicação revela a resposta antes da tentativa e atribui indicadores de estratégia e mestria a eventos que não demonstram raciocínio. Treinar um adversário mais forte não altera esses comportamentos. Esta é uma conclusão de desenho a partir dos caminhos de código descritos abaixo, não uma medição de aprendizagem com alunos.

Recomendo uma alteração incremental com três resultados observáveis: o aluno faz uma escolha antes da solução; a aplicação distingue tentativa autónoma, ajuda e repetição; o progresso apresenta evidência por estratégia. Não há razão técnica encontrada nesta auditoria para reescrever regras, motores ou o learner-core por completo.

## 1. Onde o comportamento observado nasce

### A resposta aparece sem pedido explícito

No Atari Go, o estado inicial é H2. Ainda assim, a interface apresenta `TopMovesRail`, a resposta mínima a uma ameaça e destaques de jogada. O registo adaptativo só considera ajuda quando `hintLevel === 'H3'`. Assim, copiar uma opção visível em H2 pode ser contado como sucesso sem ajuda. Dominório, Gatos & Cães, Quelhas, Produto e Nex têm os mesmos pontos de apresentação e registo. [AtariGoGame](../../src/games/atari-go/AtariGoGame.tsx), [DominorioGame](../../src/games/dominorio/DominorioGame.tsx), [GatosCaesGame](../../src/games/gatos-caes/GatosCaesGame.tsx), [QuelhasGame](../../src/games/quelhas/QuelhasGame.tsx), [ProdutoGame](../../src/games/produto/ProdutoGame.tsx), [NexGame](../../src/games/nex/NexGame.tsx).

Consequência de desenho: mudar apenas o texto da pista deixa a solução acessível pelos outros elementos. O nível de ajuda deve controlar todos os canais que revelam a jogada, incluindo marcas no tabuleiro, coordenadas, alternativas, ameaças e texto explicativo. O estado precisa de guardar a maior ajuda já vista nessa posição; esconder a pista depois não recupera a independência da tentativa.

### Uma tentativa corrigida pode ser registada como autónoma

O Laboratório guarda `usedHint` apenas quando se carrega no botão de pista. Uma resposta errada mostra a respetiva explicação. O aluno pode escolher outra opção, confirmar e receber `used_alone`, porque não há contador de tentativas nem registo de feedback visto. A escolha de resposta certa é avaliada num catálogo de três opções. [PuzzlePage](../../src/components/PuzzlePage.tsx), [puzzles](../../src/ai-core/puzzles.ts).

O mesmo fluxo impede uma demonstração posterior de autonomia: depois de um puzzle ser resolvido com ajuda, `solved.has(puzzle.id)` faz sair antes de registar nova evidência de padrão. A deduplicação evita XP repetido, mas também elimina dados úteis de aprendizagem. O feedback chega a chamar ao puzzle já resolvido uma ideia dominada. [PuzzlePage](../../src/components/PuzzlePage.tsx), [recordPuzzleSolved](../../src/ai-core/learner-gamification.ts).

### Revisão concluída significa carregar num botão

Os seis jogos mostram explicação e alternativa, depois permitem marcar a revisão como concluída. O botão dá XP e emite `seen` para um padrão. Não pede uma nova escolha nem verifica uma previsão. No Atari Go, `buildTurningPoints` também preenche `playedMove` e `bestMove` com a mesma jogada sugerida antes da ação do aluno. Esse objeto identifica uma posição interessante, mas não comprova um erro que o aluno tenha cometido. [AtariGoGame](../../src/games/atari-go/AtariGoGame.tsx), [adaptador Atari Go](../../src/games/atari-go/ai/v1-adapter.ts), [revisões dos restantes jogos](../../src/ai-core/review-patterns.ts).

O gráfico de avaliação é outro mecanismo: regista valores quando o adversário pensa e escolhe a maior queda entre amostras. Uma queda pode ajudar a escolher uma posição para rever, mas o traço por si só não inclui o raciocínio do aluno nem uma comparação controlada entre a jogada feita e uma alternativa. [eval-trace](../../src/ai-core/eval-trace.ts).

## 2. O que a progressão mede atualmente

| Indicador | Regra observada | Limitação pedagógica |
|---|---|---|
| Regras, de 0 a 5 | `ceil(partidas / 2)`, limitado a 5 | Mede participação, não conhecimento das regras |
| Estratégia, de 0 a 5 | `ceil(vitórias / 2)` ou `ceil(puzzles resolvidos / 2)`; estados de padrões também a podem elevar | Mistura volume, resultado e evidência de padrões |
| Mestria, de 0 a 5 | `ceil(revisões / 2)`, limitado a 5 | Nove revisões assinaladas bastam para 5/5 |
| Padrão dominado | Três `contextId` distintos com `used_alone` | Não exige intervalo temporal, transferência ou primeira tentativa |
| Etapa do percurso | Puzzles resolvidos e vitórias, sequência ou percentagem contra um nível | Pistas e revisão não entram no critério |
| Dificuldade sugerida | Pelo menos quatro decisões; sobe acima de 60% de sucesso, sem pistas contadas nem erros repetidos | Sucesso é geralmente pertença às três sugestões do tutor |

Fontes das regras: [learner-gamification](../../src/ai-core/learner-gamification.ts), [training-paths](../../src/ai-core/training-paths.ts), [adaptive-difficulty](../../src/ai-core/adaptive-difficulty.ts). Os rótulos visíveis são Regras, Estratégia e Mestria. [GameProgressBars](../../src/components/gamification/GameProgressBars.tsx).

Duas execuções em memória reproduziram o problema: nove chamadas de revisão, sem qualquer partida, resultaram em `mastery: 5`; nove vitórias sem dados sobre decisões resultaram em `rules: 5` e `strategy: 5`. Isto verifica a regra do programa. Não demonstra que os alunos usem esses atalhos de propósito.

### Padrões com progressão impossível pelo percurso atual

O catálogo tem 45 puzzles, dos quais 21 têm diagrama. Há 25 padrões representados; só seis têm três ou mais puzzles. As emissões de `used_alone` na interface vêm do Laboratório. As revisões emitem apenas `seen`. Como a resolução repetida do mesmo puzzle não cria um novo contexto, 19 dos 25 padrões com puzzles não conseguem chegar a três contextos autónomos pelo fluxo atual. [catálogo](../../src/ai-core/puzzles.ts), [emissão no Laboratório](../../src/components/PuzzlePage.tsx), [modelo de padrão](../../src/ai-core/learner-gamification.ts).

| Jogo | Puzzles | Com diagrama | Padrões com pelo menos três puzzles |
|---|---:|---:|---:|
| Gatos & Cães | 7 | 4 | 1 de 3 |
| Dominório | 7 | 4 | 1 de 4 |
| Quelhas | 7 | 1 | 1 de 4 |
| Produto | 7 | 3 | 1 de 3 |
| Atari Go | 10 | 7 | 1 de 7 |
| Nex | 7 | 2 | 1 de 4 |

Contagem feita diretamente sobre `PUZZLES`; os testes do catálogo confirmam os 45 itens, a associação a padrões e a estrutura dos diagramas. [puzzles.test](../../src/ai-core/puzzles.test.ts).

### Persistência perde a origem do sucesso

Uma partida envia `gameId`, `won` e `difficultyLevel`. A tabela por nível guarda partidas, vitórias e sequências. Não guarda ajuda, cor, abertura, versão do motor nem decisões autónomas. Um N6 que desce silenciosamente para N5 continua a enviar o nível selecionado. Assim, não é possível usar esses resultados antigos como prova de uma vitória autónoma contra um motor específico. [rotas learner-core](../../src/server/learner-core/http.ts), [serviço](../../src/server/learner-core/service.ts), [migração 004](../../src/server/learner-core/migrations/004_level_progress.sql), [cliente Atari Go](../../src/games/atari-go/ai/ai-client.ts), [cliente Quelhas](../../src/games/quelhas/ai/ai-client.ts).

As decisões adaptativas vivem no estado React, são reiniciadas por sessão e não integram o histórico persistente. Não permitem medir redução de um erro ao longo de várias aulas. As rotas de partida e revisão também não recebem um identificador de partida para deduplicar envios; a proteção de repetição está principalmente no componente montado. [GamificationProvider](../../src/components/gamification/GamificationProvider.tsx), [serviço learner-core](../../src/server/learner-core/service.ts).

## 3. O tutor e a força dos motores precisam de avaliações diferentes

Os adaptadores juntam a melhor jogada do motor a alternativas produzidas por uma heurística local. Estas alternativas não equivalem necessariamente às melhores três linhas da busca. No Quelhas, o tutor favorece segmentos curtos e atribui confiança de 0,82, 0,70 e 0,58 pela posição na lista. No Dominório, a frase explicativa depende do índice e do número de opções. Produto e Nex acrescentam candidatos de uma lista limitada e avaliam-nos separadamente. [Quelhas](../../src/games/quelhas/ai/v1-adapter.ts), [Dominório](../../src/games/dominorio/ai/v1-adapter.ts), [Produto](../../src/games/produto/ai/v1-adapter.ts), [Nex](../../src/games/nex/ai/v1-adapter.ts).

Gatos & Cães e Atari Go usam simulação local para explicar mobilidade, liberdades e capturas. É uma base útil para factos verificáveis. Contudo, a pertença ao top 3 continua a ser uma aproximação, não uma prova geral de boa estratégia. [Gatos & Cães](../../src/games/gatos-caes/ai/v1-adapter.ts), [Atari Go](../../src/games/atari-go/ai/v1-adapter.ts).

O pedido do tutor usa o nível escolhido para jogar. Uma avaliação para ensinar deve ter um orçamento de análise estável e independente da força do adversário. O contrato comum já dispõe de `principalVariation`, `predictedState`, `stats` e `criticalThreats`; pode receber avaliações comparáveis das alternativas sem reescrever os jogos. A confiança precisa de representar o que foi medido, distinguindo prova exata, avaliação de busca e preferência heurística. [contrato AIResponse](../../src/ai-core/types.ts), [pedidos no Atari Go](../../src/games/atari-go/AtariGoGame.tsx), [pedidos no Dominório](../../src/games/dominorio/DominorioGame.tsx).

### Estado técnico dos seis jogos

| Jogo | Implementação encontrada | Evidência disponível e próximo passo |
|---|---|---|
| Gatos & Cães | TypeScript, negamax, alpha-beta, aprofundamento iterativo e tabela de transposições | O motor já tem busca estruturada. Medir contra uma versão fixa antes de considerar um porte. [engine](../../src/games/gatos-caes/ai/engine.ts) |
| Dominório | Rust/WASM com busca e tabela de transposições | N5 venceu N4 por 51–9 em 60 partidas, seed 20260719 e limite 2 s. Há margem para extrair finais e explicações de mobilidade. [motor](../../wasm/dominorio_ai/src/engine.rs), [arena](../../artifacts/dominorio-arena/2026-07-19T10-35-16-884Z/results.json) |
| Quelhas | Rust/WASM e cliente N6 de rede já ligado ao jogo | Arena da rede: 39–1, zero ilegais, n=40. Resultado forte na amostra, abaixo do requisito local n≥50. Reavaliar antes de novo veredicto de força. [motor](../../wasm/quelhas/quelhas-ai/src/engine.rs), [integração N6](../../src/games/quelhas/QuelhasGame.tsx), [arena](../../artifacts/quelhas-arena/2026-07-19T09-23-00-373Z/results.json) |
| Produto | Rust/WASM com alpha-beta, aprofundamento iterativo e avaliação incremental; WASM preferido em N5 | Arena n=50, seed 20260720, 2 s: WASM 50–0 TS; uma confirmação posterior de 20 partidas também passou. Há motor suficiente para comparação de consequências. [busca](../../wasm/produto_ai/src/core/ai.rs), [worker](../../src/games/produto/ai/produto.worker.ts), [arena](../../artifacts/produto-arena/2026-07-19T18-57-42-679Z/results.json) |
| Atari Go | Rust/WASM e cliente N6 de rede com fallback | N6 venceu N5 por 46–4, zero ilegais, n=50, a 500 ms. O resultado não mede o N5 ao orçamento de produção de 2 s. [cliente](../../src/games/atari-go/ai/ai-client.ts), [arena](../../artifacts/atari-go-arena/2026-07-18T15-24-50-705Z/results.json), [orçamentos e treino](../../training/README.md) |
| Nex | Rust/WASM, busca com transposições, ordenação por caminhos e deadline | O código contém a busca atual. A auditoria de julho regista 47–48 vitórias em 50 contra o legado; não voltei a executar esse duelo nesta tarefa. [motor](../../wasm/nex_ai/src/lib.rs), [registo de julho](../agents/AI-TRAINING-STATUS-2026-07-18.md) |

A documentação histórica precisa de ser tratada com cuidado: o documento de julho ainda diz que a integração N6 do Quelhas está pendente, mas o cliente e a página do jogo já a usam. O documento dos percursos também contém números antigos do catálogo e descreve o Produto anterior. Os caminhos de código e os artefactos são a referência desta auditoria. [estado histórico](../agents/AI-TRAINING-STATUS-2026-07-18.md), [percursos históricos](../PERCURSOS-CAMPEONATO.md).

## 4. Caminho mínimo para uma melhoria significativa

As prioridades seguintes são decisões de produto recomendadas a partir do diagnóstico.

### P0: o aluno decide antes de ver a solução

1. Começar cada posição sem casas sugeridas. A primeira ajuda faz uma pergunta sobre o padrão; a seguinte chama a atenção para uma característica; a demonstração completa exige um pedido explícito.
2. Registar a primeira escolha, a maior ajuda vista e se houve feedback antes do acerto. Uma tentativa após explicação conta como treino com apoio.
3. Separar XP por participação de evidência de estratégia. Manter histórico e recompensas existentes; apresentar os indicadores antigos como atividade, sem reinterpretá-los retroativamente como domínio.
4. No Laboratório, permitir nova evidência depois de uma resolução com ajuda, sem voltar a atribuir o prémio inicial. Uma repetição imediata continua a ser prática, não transferência.
5. Mostrar ao aluno uma próxima ação concreta: experimentar outra posição do mesmo padrão, explicar a consequência ou tentar novamente noutra sessão.

Integrações: um modelo puro em `ai-core`, o estado do `PuzzlePage`, o provider de gamificação, as rotas do learner-core e um controlo comum da ajuda nos seis jogos. O esquema atual de padrões e migrações numeradas permite acrescentar evidência sem uma reescrita. [gamificação](../../src/ai-core/learner-gamification.ts), [provider](../../src/components/gamification/GamificationProvider.tsx), [migrações](../../src/server/learner-core/db.ts).

### P1: progressão com transferência

1. Guardar eventos de tentativa com `attemptId`, jogo, padrão, posição, primeira resposta, resultado, ajuda e instante. O servidor calcula o estado do padrão; o cliente deixa de declarar diretamente domínio.
2. Usar estados legíveis: conheceu, experimentou com ajuda, conseguiu sozinho, aplicou noutra posição, confirmou noutra sessão. Os dois últimos precisam de variantes e tempo decorrido, além de acerto.
3. Separar critério de aprendizagem e desafio competitivo. Vitórias continuam úteis como treino de partida, acompanhadas de cor, nível efetivo, motor e ajuda; não substituem a prova do padrão.
4. Na revisão, recuperar a posição antes da decisão do aluno. Pedir nova escolha ou uma previsão de consequência antes de mostrar a linha do motor.
5. Criar variantes suficientes para todos os padrões nucleares. Os finais resolvidos já existentes oferecem material inicial com verificação das regras. [extração de lições](../../scripts/extract-lessons.ts), [candidatos clássicos](../../artifacts/lessons-classic/2026-07-18T18-04-39-162Z/), [candidatos Atari Go](../../artifacts/atari-go-lessons/2026-07-18T17-33-20/puzzle_candidates.json).

### P2: IA que ajuda a compreender consequências

1. Pedir ao motor a avaliação da escolha do aluno e de uma alternativa com o mesmo orçamento e a mesma perspetiva.
2. Produzir factos pelas regras do jogo: quantas casas legais ficam, que grupo perde uma liberdade, que ligação aparece, quem joga por último num final resolvido.
3. Explicar uma diferença concreta entre duas escolhas. Uma frase genérica de intenção não basta para concluir que aquela jogada tem o efeito anunciado.
4. Só depois explorar uma rede que proponha posições adequadas ou estime dificuldade para o aluno. Medir com desempenhos humanos novos, não apenas com partidas da rede contra si própria.

## 5. Medir força e medir ensino

### Avaliação de força do motor

Manter os gates do projeto: arenas serializadas, pelo menos 50 jogos, aberturas e cores emparelhadas, seed, orçamento, zero jogadas ilegais e latência dentro do limite. Guardar versão do motor/checkpoint e o fallback efetivamente usado. Uma arena com n=10 já inverteu o veredicto do Produto quando alargada. [CLAUDE.md](../../CLAUDE.md), [histórico de calibração](../agents/AI-TRAINING-STATUS-2026-07-18.md).

Adicionar uma coleção fixa de posições táticas e finais. Medir taxa de decisões corretas onde há prova, estabilidade das alternativas e tempo de resposta. Isso avalia a capacidade de analisar posições para ensino, que uma taxa de vitória isolada não mede.

### Avaliação pedagógica em sala

Este é um protocolo recomendado para validar a alteração, não um resultado já obtido:

- Antes do treino, apresentar posições curtas sem sugestões e guardar a primeira escolha e uma previsão simples.
- Durante o treino, medir ajuda pedida, soluções reveladas, acertos à primeira tentativa e padrões que exigem repetição.
- Depois do treino, apresentar posições novas do mesmo padrão, sem sugestões. Repetir numa aula posterior com outras posições equivalentes.
- Usar como medida principal o acerto autónomo nas posições novas. Reportar também a explicação ou previsão correta e a repetição do erro-alvo.
- Acompanhar abandono, pedidos de ajuda e observações do professor. Tempo de decisão é contexto, não um substituto de compreensão nem um requisito de rapidez.
- Separar alunos e sessões para não misturar o progresso de crianças que usam o mesmo perfil do browser. O comportamento de associação por cookie já está documentado. [checklist de sala](../CLASSROOM-CHECKLIST.md).

Definir antes do piloto quais os padrões e qual a melhoria mínima considerada útil. Sem esse dado, é possível demonstrar que o produto deixa de entregar a resposta e passa a medir autonomia; não é possível afirmar que os alunos aprenderam mais.

## 6. Uso da RTX

Já existem pipelines AlphaZero, checkpoints e extração de lições para Atari Go e Quelhas. O treino documentado foi de 30 iterações e 60 000 jogos por jogo. O melhor uso imediato da GPU, quando estiver disponível, é reanalisar posições para produzir variantes e comparar consequências, seguido de verificação das regras e curadoria. Não iniciar outro treino longo para corrigir o problema de cliques sugeridos. [training/README](../../training/README.md), [extração Atari Go](../../training/atari_go/extract_lessons.py), [serviço Quelhas](../../training/quelhas/serve.py).

Na consulta local desta auditoria, o acesso direto devolveu `Failed to initialize NVML: Insufficient Permissions`. A consulta mínima no container CUDA com os parâmetros documentados falhou antes de iniciar por falta de `/run/nvidia-persistenced/socket`. A listagem de containers ativos não mostrou os serviços `crjm-az-serve` ou `crjm-qz-serve`. Não foi iniciado treino, não foi alterada a infraestrutura e não foi possível confirmar a GPU operacional nesta sessão.

## 7. Verificação realizada e lacunas dos testes

Comando executado, sem acesso à base de dados real:

```sh
bun test src/ai-core/learner-gamification.test.ts src/ai-core/adaptive-difficulty.test.ts src/ai-core/training-paths.test.ts src/ai-core/puzzles.test.ts src/server/learner-core/service.test.ts src/server/learner-core/api.test.ts
```

Resultado: 42 testes passaram, zero falhas, 4342 asserções. A suite verifica deduplicação de puzzles e missões, progressão monotónica de padrões, persistência, transações, níveis, catálogo e regras da recomendação. Não verifica que as casas ficam escondidas antes da tentativa, que feedback já visto exclui autonomia, que uma revisão contém uma decisão, nem que uma explicação descreve um efeito real no tabuleiro. [testes de gamificação](../../src/ai-core/learner-gamification.test.ts), [serviço](../../src/server/learner-core/service.test.ts), [catálogo](../../src/ai-core/puzzles.test.ts).

Testes de comportamento a acrescentar com a implementação:

- Nos seis jogos, a posição inicial não revela a jogada; pedir ajuda revela apenas o nível escolhido e conserva a exposição para o registo da decisão.
- Errar e corrigir, ou ver a solução e voltar atrás, não produz evidência autónoma.
- Resolver com ajuda e conseguir depois noutra sessão melhora o padrão sem duplicar XP inicial.
- Uma revisão visualizada não aumenta domínio; uma resposta transferida e verificada pode acrescentar evidência.
- Um envio repetido ou uma resposta de rede atrasada não duplica nem perde uma tentativa.
- Uma posição sem avaliação suficiente fica sem classificação de qualidade, em vez de tratar pertença ao top 3 como verdade.

As arenas não foram repetidas nesta auditoria. A inspeção real da UI e os gates completos de build, sala de aula e learner-core pertencem à validação da implementação.
