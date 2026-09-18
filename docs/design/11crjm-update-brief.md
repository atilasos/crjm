# Atualização para o 11.º CRJM — 2026/27

Este brief é um registo histórico da preparação de 17 de setembro de 2026, anterior à implementação. O texto original abaixo preserva a entrevista e as decisões confirmadas. As referências ao catálogo atual, à implementação ainda não iniciada e à contagem de Y por validar descrevem o estado observado nessa fase.

Para consultar o resultado entregue, ver a [ativação da edição completa em `9d8bfb0`](../agents/reviews/issue38-edition.md), a [validação do tabuleiro de Y](y-board-validation.md) e as [correções e verificações finais em `65cd4ec`](../agents/reviews/11crjm-review-fixes.md). Estes registos documentam a implementação posterior e as suas evidências.

Estado: entendimento confirmado pelo utilizador em 17 de setembro de 2026. A pedido do utilizador, a síntese foi convertida na [especificação](11crjm-spec.md) para publicação no gestor de issues.

Publicada e verificada na [issue #25](https://github.com/atilasos/crjm/issues/25), com a etiqueta `ready-for-agent`. O corpo publicado corresponde à especificação local. A implementação da app ainda não foi iniciada.

## Pedido confirmado

Atualizar a app com os novos jogos do campeonato e conservar os jogos antigos num arquivo jogável. A entrevista usa `grill-with-docs` (grilling e domain-modeling); a investigação usa `research`.

## Distribuição fornecida

Fonte: imagem `Tabela_jogos_2026.jpg`, anexa ao pedido de 17 de setembro de 2026.

| Jogo | Ciclos na nova edição | Diferença face ao catálogo atual |
| --- | --- | --- |
| Dominório | 1.º | Deixa de integrar o 2.º ciclo |
| Faísca | 1.º e 2.º | Novo jogo |
| Quelhas | 1.º, 2.º e 3.º | Mantém distribuição |
| Produto | 2.º, 3.º e secundário | Mantém distribuição |
| Atari Go | 3.º e secundário | Mantém distribuição |
| Y | Secundário | Novo jogo |

Gatos & Cães e Nex estão no [catálogo atual](../../src/App.tsx), mas não constam da tabela recebida. Os regulamentos de Faísca e Y foram fornecidos em DOCX; as fontes e regras estão registadas na [investigação](../research/11crjm-2026.md). A fonte da DRE identifica o ano letivo como 2026/27, com prova anunciada para 19 de fevereiro de 2027; o nome do ficheiro da tabela não deve ser usado como ano da prova.

## Árvore de decisões

- **Q1 — Alcance do arquivo** (confirmado pelo utilizador).
  - Apenas Gatos & Cães e Nex, conservando todas as funcionalidades atuais; os quatro jogos comuns continuam ativos numa única versão.
  - Não se pretende uma cópia integral da edição anterior nem um arquivo de partidas.
- **Q2 — Integração de Faísca e Y** (confirmado pelo utilizador).
  - Integração completa: dois jogadores, computador, torneios online, aprendizagem e progresso.
  - A paridade abrange tutor, revisão, percursos, puzzles e os idiomas existentes (PT-PT, inglês e nepalês). A força da IA exige validação própria.
- **Q3 — Visibilidade do arquivo** (confirmado pelo utilizador).
  - Edição atual por defeito no início, Laboratório e criação de torneios; acesso explícito ao arquivo nessas áreas. Perfil mantém progresso e XP.
- **Q4 — Objetivo da IA** (confirmado pelo utilizador).
  - Motores locais com dificuldade progressiva validada por partidas automáticas; investigação e treino de IA em GPU fora desta atualização.
- **Regras e edição oficial** (investigadas; ver fontes e limites na nota de pesquisa).
  - Faísca: tabuleiro 5×6, inventários de peças de distância 1/2/3, próxima casa obrigatória e quatro direções. O destino tem de estar vazio também na abertura; pode saltar sobre peças. As regras originais do autor sustentam os detalhes que o texto português deixa implícitos.
  - Y: reproduzir o grafo ilustrado, troca de cores e vitória por um grupo conexo que toque os três lados. Transcrever e verificar nós, arestas e lados é trabalho técnico necessário; a contagem dos nós do anexo ainda não foi validada.
  - Não importar regras adicionais de variantes nem supor equivalência entre uma grelha triangular regular e o tabuleiro fornecido.
- **Síntese final** (confirmada pelo utilizador).
  - O utilizador confirmou "temos entendimento" e invocou `to-spec`. O próximo resultado pedido é a especificação publicada, sem nova entrevista.

## Registos

O [glossário](../../CONTEXT.md) distingue modalidade de partida, edição de campeonato e arquivo jogável. Nenhuma decisão arquitetural nova foi tomada; não se cria um ADR antes de existir um compromisso que o justifique.

## Factos da app com impacto na atualização

- Existem seis jogos implementados; Faísca e Y ainda não existem. A atualização passará a ter oito modalidades, seis atuais e duas arquivadas.
- O catálogo e os identificadores estão repetidos em várias camadas: [homepage](../../src/App.tsx), [IA](../../src/ai-core/types.ts), [protocolo de torneios](../../src/tournament/protocol.ts), seletores e conteúdos pedagógicos.
- O progresso é associado ao utilizador e ao jogo, sem dimensão de edição: [schema](../../src/server/learner-core/migrations/001_initial.sql) e [serviço](../../src/server/learner-core/service.ts). A preservação implica manter os identificadores atuais e as ligações `#/gatos-caes` e `#/nex`.
- Todos os jogos atuais têm dois jogadores locais, computador e torneio online. O online inclui administração e espectador, que também entram na integração dos novos jogos.
- Os idiomas existentes são PT-PT, inglês e nepalês: [configuração](../../src/i18n/locale.ts).
- A paridade pedagógica deve conservar a separação entre prática e evidência de aprendizagem, bem como os pedidos explícitos de ajuda: [piloto existente](../research/strategy-learning-pilot.md).

## Critérios de aceitação propostos para a síntese final

- A seleção atual corresponde à tabela recebida; os jogos arquivados continuam acessíveis também pelas ligações antigas.
- O arquivo permite jogar localmente, contra computador e em torneios, mantendo tutor, revisão, puzzles, percursos e progresso.
- Faísca e Y têm regras e tabuleiros fiéis aos regulamentos fornecidos, com fontes e eventuais lacunas explicitadas antes de implementar.
- As mesmas regras determinam jogadas legais e resultados no modo local, IA e servidor de torneios. Validar limites, posições terminais e regras especiais, não apenas partidas correntes.
- Ambos os novos jogos integram cliente de torneios, administração, espectador e reconexão, além das áreas locais e de aprendizagem.
- Os novos conteúdos seguem o sistema visual e os três idiomas existentes. As ajudas preservam o pedido explícito e a distinção entre prática orientada e evidência de autonomia.
- Os motores funcionam localmente; a medição de força usa pelo menos 50 partidas, aberturas emparelhadas e seed registada, conforme [instruções do projeto](../../CLAUDE.md). Arenas com orçamento de tempo são executadas em série e guardam resultados reproduzíveis. Os nomes dos níveis não equivalem a força competitiva demonstrada.
- O progresso anterior é preservado por identificador de jogo. Acrescentar jogos não reinicia XP nem oculta dados dos jogos arquivados.
- Verificar os oito jogos e os filtros atual/arquivo em computador, tablet e telemóvel, incluindo temas e idiomas existentes. As verificações funcionais devem cobrir os novos fluxos e a preservação dos antigos.

## Sequência técnica proposta

1. Consolidar catálogo de jogos e pertença à seleção atual/arquivo, conservando identificadores e rotas.
2. Implementar e testar regras/tabuleiros dos dois jogos a partir das fontes verificadas.
3. Integrar motores locais, validar dificuldades e ligar tutor/revisão.
4. Completar conteúdos de aprendizagem, progresso e traduções.
5. Integrar torneios/admin/espectador, executar regressão e preparar a atualização para revisão.

A sequência serve a implementação; não reduz a integração completa pedida para a entrega. A publicação da especificação no gestor de issues foi pedida após a entrevista. A publicação da app não faz parte desse pedido.
