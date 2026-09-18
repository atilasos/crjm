# Atualizar a app para o 11.º CRJM 2026/27 com Faísca, Y e arquivo jogável

## Problem Statement

Os alunos e professores precisam de treinar os jogos do 11.º CRJM, mas a app apresenta a seleção anterior. Faltam Faísca e Y, Gatos & Cães e Nex aparecem como jogos atuais, e Dominório ainda está associado ao 2.º ciclo. Esta diferença pode levar um aluno a preparar um jogo que não pertence ao seu escalão.

A atualização tem de preservar o acesso aos jogos que saem e todo o trabalho dos alunos. Retirar cartões do início não basta: os jogos também aparecem no Laboratório, nos torneios, no perfil e nos conteúdos de aprendizagem.

## Solution

A app passa a apresentar a seleção do 11.º CRJM 2026/27 por defeito. Faísca e Y recebem integração completa nas áreas existentes. Gatos & Cães e Nex ficam num Arquivo jogável, acessível explicitamente no início, no Laboratório e na criação de torneios, com todas as funcionalidades atuais.

| Jogo atual | Ciclos de ensino |
| --- | --- |
| Dominório | 1.º |
| Faísca | 1.º e 2.º |
| Quelhas | 1.º, 2.º e 3.º |
| Produto | 2.º, 3.º e secundário |
| Atari Go | 3.º e secundário |
| Y | Secundário |

São oito jogos distintos: seis atuais e dois arquivados. Os quatro jogos que continuam mantêm uma única implementação e o progresso existente. O arquivo contém modalidades, não partidas passadas nem uma cópia completa da edição anterior.

## User Stories

1. Como aluno, quero encontrar os seis jogos da edição atual ao entrar na app, para escolher um treino que corresponda ao campeonato.
2. Como aluno, quero consultar os ciclos associados a cada jogo, para saber quais pertencem ao meu escalão.
3. Como aluno do 2.º ciclo, quero ver Faísca na seleção e deixar de ver Dominório associado ao meu ciclo, para preparar os jogos corretos.
4. Como aluno, quero abrir o Arquivo a partir do início, para continuar a jogar Gatos & Cães e Nex.
5. Como aluno, quero que as ligações antigas para os jogos arquivados continuem a funcionar, para usar os meus favoritos e materiais anteriores.
6. Como aluno, quero reconhecer quando estou num jogo arquivado e regressar à seleção correspondente, para manter o contexto da navegação.
7. Como aluno, quero abrir as regras de Faísca e Y dentro da app, para aprender sem depender de outro documento.
8. Como aluno, quero jogar Faísca e Y com outra pessoa no mesmo dispositivo, para praticar com um colega.
9. Como aluno, quero jogar os dois jogos novos contra o computador, para treinar quando não tenho um colega disponível.
10. Como aluno, quero escolher dificuldades locais com diferenças verificadas, para encontrar um adversário adequado ao meu treino.
11. Como aluno, quero que a IA dos jogos novos funcione sem um serviço remoto de IA, para não depender desse serviço para jogar.
12. Como jogador de Faísca, quero ver a casa obrigatória e as minhas peças disponíveis por distância, para compreender as escolhas do turno.
13. Como jogador de Faísca, quero escolher a peça e a sua direção e perceber qual será o destino, para antecipar a próxima jogada do adversário.
14. Como jogador de Faísca, quero poder apontar por cima de peças quando o destino é válido, para jogar segundo o exemplo do regulamento.
15. Como jogador de Faísca, quero que a app recuse destinos ocupados, fora do tabuleiro ou peças indisponíveis, para que a partida respeite as regras.
16. Como jogador de Faísca, quero que a app reconheça quando um jogador já não consegue jogar, para obter o resultado correto.
17. Como jogador de Y, quero jogar no tabuleiro ilustrado no regulamento, para treinar as ligações usadas no campeonato.
18. Como segundo jogador de Y, quero poder trocar de cores na minha primeira oportunidade, para exercer a regra de equilíbrio.
19. Como jogador de Y, quero que o turno e a minha cor fiquem claros após uma troca, para continuar a partida sem confundir os jogadores.
20. Como jogador de Y, quero que a vitória dependa de um único grupo que toque os três lados, para que grupos separados não originem uma vitória indevida.
21. Como aluno, quero pedir ajuda gradualmente nos jogos novos, para pensar antes de ver uma jogada exemplificada.
22. Como aluno, quero rever uma partida terminada, para compreender uma decisão relevante e continuar a aprender.
23. Como aluno, quero encontrar puzzles e percursos de Faísca e Y no Laboratório, para praticar além das partidas completas.
24. Como aluno, quero exercícios de escolha e previsão nos jogos novos, para explicar o efeito esperado de uma jogada.
25. Como aluno, quero que pistas, erros e novas tentativas mantenham o significado atual no progresso, para que prática orientada não seja contada como resolução autónoma.
26. Como aluno, quero consultar os jogos arquivados no Laboratório, para continuar os percursos que já comecei.
27. Como aluno, quero conservar XP, conquistas, atividade e progresso dos jogos antigos, para que a mudança de edição não apague o meu trabalho.
28. Como aluno, quero que Faísca e Y apareçam no meu perfil com progresso próprio, para acompanhar a aprendizagem de cada jogo.
29. Como aluno, quero regressar noutra sessão e encontrar o progresso guardado, para continuar o treino sem recomeçar.
30. Como professor, quero que a criação de torneios apresente os jogos atuais por defeito, para organizar a competição da nova edição.
31. Como professor, quero selecionar explicitamente o Arquivo ao criar torneios, para continuar a organizar competições de Gatos & Cães e Nex.
32. Como participante, quero disputar Faísca e Y nos torneios online existentes, para treinar em competição com outros alunos.
33. Como participante, quero que o servidor aplique as mesmas regras do jogo local, para obter resultados consistentes.
34. Como participante, quero recuperar o estado correto após uma reconexão, incluindo a casa obrigatória de Faísca ou a troca de Y, para continuar a partida.
35. Como professor, quero acompanhar os novos jogos no painel de administração, para gerir o torneio com as ferramentas atuais.
36. Como espectador, quero observar os tabuleiros e turnos dos novos jogos, para acompanhar a partida sem intervir nela.
37. Como aluno, quero usar os novos jogos e o Arquivo em português de Portugal, inglês ou nepalês, para manter o idioma que já utilizo.
38. Como aluno, quero jogar e navegar no computador, tablet e telemóvel, para usar o dispositivo disponível.
39. Como aluno, quero controles legíveis, identificação de turno e peças que não dependam apenas da cor, para compreender e operar o jogo.
40. Como aluno, quero que os novos jogos respeitem os temas e a apresentação da app, para encontrar uma experiência consistente.
41. Como professor, quero saber que os níveis da IA foram avaliados com partidas reproduzíveis, para interpretar o seu significado sem presumir jogo perfeito.
42. Como utilizador de um dos seis jogos existentes, quero conservar os modos e ferramentas já disponíveis, para que a atualização não reduza as minhas opções de treino.

## Implementation Decisions

- Manter a arquitetura atual da app, o núcleo de progresso persistente e os contratos de torneio. Esta atualização não executa uma migração de plataforma, autenticação ou base de dados.
- Consolidar a identidade dos jogos e os metadados de seleção atual/arquivo e ciclos num catálogo partilhado pelos consumidores relevantes. A identidade de um jogo não muda quando ele sai da edição atual.
- Preservar os identificadores dos seis jogos existentes e acrescentar identificadores próprios para Faísca e Y. Conservar as ligações existentes dos jogos arquivados. Evitar listas divergentes entre início, Laboratório, perfil, torneio e administração.
- Usar os seis jogos atuais como seleção inicial no início, Laboratório e criação de torneios. Disponibilizar uma seleção explícita de Arquivo nessas áreas. Manter os dados dos oito jogos no perfil.
- Conservar Gatos & Cães e Nex com dois jogadores locais, computador, torneios, tutor, revisão, puzzles, percursos, progresso e idiomas. Os quatro jogos que permanecem atuais não são duplicados.
- Acrescentar regras, estado de partida, tabuleiro e integração de IA para cada jogo novo. Reutilizar as interfaces existentes de modos locais, dificuldade, tutor, revisão e progresso.
- Aplicar a mesma lógica de legalidade e resultado nos modos locais, motores de IA e adaptadores do servidor. O servidor valida jogadas recebidas; a interface não é a autoridade para aceitar jogadas online.
- Em Faísca, usar um tabuleiro vazio de cinco linhas por seis colunas. Cada jogador recebe cinco peças de distância 1, cinco de distância 2 e cinco de distância 3. Azul inicia.
- Na abertura de Faísca, permitir uma casa de colocação livre. Depois, a colocação é obrigatória na casa indicada pela peça anterior. O jogador escolhe uma peça disponível e uma das quatro direções ortogonais. O destino, à distância exata da peça, tem de ser uma casa vazia dentro do tabuleiro, incluindo na abertura. Casas intermédias ocupadas não impedem a jogada.
- Em Faísca, consumir a peça escolhida, guardar a orientação, atualizar a casa obrigatória e alternar o turno apenas após uma jogada válida. Perde o jogador que não consegue efetuar uma jogada válida ou já não tem peças. Não acrescentar troca de cores nem diagonais.
- Em Y, transcrever o desenho fornecido como nós, ligações e pertença aos três lados. Validar a transcrição contra a imagem antes de usar esse grafo nas regras, na IA e nos exercícios. A apresentação geométrica e a adjacência têm de representar o mesmo tabuleiro.
- Não assumir uma grelha triangular regular para Y. O documento fornece 47 peças de cada cor, mas isso não determina o número de nós. A correspondência com uma versão de 93 nós é uma hipótese a verificar, não um valor já certificado.
- Em Y, colocar uma peça por turno numa intersecção livre. Na primeira oportunidade do segundo jogador, permitir trocar de cores em vez de colocar uma peça. A peça inicial permanece no seu lugar; muda a atribuição das cores aos participantes e o primeiro jogador volta a jogar com a outra cor.
- Em Y, declarar vitória apenas quando um único grupo da mesma cor alcança os três lados pelas ligações desenhadas. Um canto pertence aos dois lados adjacentes. A identidade do vencedor tem de respeitar uma eventual troca de cores.
- Integrar os novos estados e ações no protocolo, no cliente de torneios, na validação do servidor, na administração e no espectador. Preservar o sistema de dupla eliminação, as operações de torneio existentes e a recuperação após reconexão.
- Usar motores locais com níveis progressivos avaliados por partidas automáticas. Reutilizar o mecanismo existente de execução de IA fora da interação principal. A escolha entre implementação local TypeScript ou WASM permanece uma decisão técnica; não foi exigida uma linguagem específica para os novos motores.
- Integrar tutor, revisão, percursos, puzzles e prática de escolha e previsão. As ajudas continuam a exigir pedido explícito; coordenadas e soluções não devem surgir prematuramente. Manter a separação existente entre prática orientada e evidência de aprendizagem autónoma, incluindo exposição a pistas e tentativas anteriores.
- Persistir o progresso dos novos jogos através do núcleo existente. Preservar XP, conquistas, atividade, progressos e importação de dados legados. Manter a associação entre utilizador e jogo; não reiniciar nem dividir o progresso por edição. Qualquer alteração de dados necessária deve ser aditiva e preservar os registos existentes.
- Completar textos, regras, controles e conteúdos de aprendizagem em português de Portugal, inglês e nepalês. Reutilizar os temas, padrões de acessibilidade e apresentação dos jogos existentes.
- Entregar ambos os jogos com o âmbito completo. A ordem interna pode separar catálogo, regras, IA, aprendizagem e torneios; essa ordem não transforma a entrega numa versão apenas local.

## Testing Decisions

- Um teste útil verifica uma ação ou contrato público e a sua consequência: jogada aceite ou recusada, estado observado, resultado, ajuda revelada, dados preservados ou seleção disponível. Não deve reproduzir o algoritmo nem depender de funções privadas, ordem interna de chamadas ou detalhes de estilo.
- A fronteira principal de aceitação é a aplicação em execução, com os percursos de aluno e professor. Estender os testes existentes de sala de aula, progresso persistente e aprendizagem estratégica, em vez de criar um sistema paralelo de testes. Os critérios destes percursos fazem parte da síntese já confirmada pelo utilizador.
- Complementar esses percursos apenas nas fronteiras públicas que permitem cobrir regras e desempenho de forma reproduzível: ações do jogo e adaptador de torneios, comandos/consultas de progresso e pedidos ao motor de IA. Não introduzir interfaces de produção exclusivamente para facilitar os testes.
- Verificar que início, Laboratório e criação de torneios apresentam seis jogos atuais e que a opção Arquivo permite aceder aos outros dois. Confirmar todos os ciclos, ligações antigas e regresso à seleção correspondente.
- Em Faísca, testar abertura, colocação obrigatória, consumo de inventário, quatro direções, distâncias exatas, saltos sobre casas ocupadas, recusa de destinos inválidos e fim por falta de jogada ou de peças. Uma tentativa inválida não pode consumir peças nem mudar o turno.
- Reproduzir pelas ações públicas a sequência do exemplo de Faísca: f3 → c3 → c1 → f1 → f2 → c2 → c5 → f5 → f4 → c4 → a4 → a2 → a5 → b5 → b4 → d4 → d1 → e1 → b1 → b2 → b3. As primeiras vinte casas recebem peças; b3 é o próximo alvo. Azul conserva duas peças de distância 1 e três de distância 2; Vermelho conserva uma de distância 1, três de distância 2 e uma de distância 3.
- Em Y, verificar o grafo transcrito contra o desenho de referência, incluindo nós dos lados e cantos. Usar posições conhecidas que distingam ligações reais de pontos apenas próximos no ecrã. A simples comparação do grafo consigo próprio não demonstra fidelidade ao anexo.
- Em Y, testar colocação numa casa vazia, recusa de casa ocupada, troca apenas na oportunidade permitida, alternância após a troca, identificação do vencedor, ligação canto-lado oposto e recusa de vitória com três grupos separados. Testar a troca também contra o computador e num torneio.
- Reproduzir sequências legais e ilegais através das regras públicas e do adaptador de torneios e comparar estados e resultados. Usar como precedente os testes existentes de lógica de jogos, adaptação e conversão de protocolo.
- Exercitar um torneio real dos novos jogos com participantes, administração e espectador. Incluir reconexão durante uma partida e confirmar estado, turno e resultado. A existência de um cartão ou tabuleiro renderizado não basta para provar integração online.
- Partir de um perfil persistido com atividade nos seis jogos anteriores e de um perfil legado importável. Confirmar que a atualização conserva os valores antigos, inicializa os novos jogos e regista novas partidas sem misturar utilizadores ou jogos. Repetir bootstrap/importação não pode duplicar XP. Apoiar-se nos testes existentes de serviço/API de progresso e no percurso completo de importação.
- Confirmar puzzles, percursos, revisão e prática estratégica para Faísca e Y, incluindo pedir pista, recarregar e voltar a tentar. Uma resposta posterior à exposição a ajuda não pode passar indevidamente a resolução autónoma. Reutilizar os testes do tutor e de aprendizagem estratégica existentes.
- Para cada veredicto de força da IA, executar pelo menos 50 partidas com aberturas emparelhadas, alternância de lados e seed registada. Guardar a configuração, orçamento de tempo, resultados e medidas de latência. Executar arenas com orçamento de tempo em série para evitar contenção de CPU.
- Exigir zero jogadas ilegais nas arenas. Comparar as dificuldades antes de as apresentar como progressivas. Não substituir essa evidência por nomes de níveis, por uma amostra menor ou por uma promessa de força equivalente a outro jogo. O número final de níveis e os limiares competitivos não foram fixados na entrevista.
- Verificar os oito jogos, o Laboratório e os filtros em computador, tablet e telemóvel, nos temas e idiomas existentes. Cobrir navegação, controles utilizáveis, legibilidade e ausência de textos em falta. Utilizar Agent Browser Hub com perfil research e encerrar as sessões no final.
- Executar a suite de testes, as verificações de sala de aula e de progresso persistente, a verificação de idiomas e o build completo, conforme os gates do projeto. Distinguir falhas anteriores de regressões e guardar os resultados relevantes. Testes novos não substituem a regressão dos jogos existentes.

## Out of Scope

- Treino, investigação e serviço de IA em GPU para Faísca ou Y.
- Prometer jogo perfeito, força de campeão ou equivalência de dificuldade entre jogos sem evidência.
- Guardar uma edição anterior completa com cópias dos seis jogos ou criar navegação histórica por todas as edições.
- Criar um arquivo de partidas, replays persistentes ou histórico completo de tabuleiros.
- Reiniciar progresso, introduzir progresso por edição ou migrar a plataforma de persistência/autenticação.
- Alterar as regras dos quatro jogos que continuam, além de corrigir a associação de Dominório aos ciclos.
- Acrescentar variantes, tamanhos alternativos de tabuleiro, relógios ou critérios oficiais de desempate que não constam dos regulamentos fornecidos. As funcionalidades atuais de torneio mantêm-se.
- Redesenhar toda a app ou criar idiomas adicionais.
- Publicar a atualização da app em produção como consequência automática da publicação desta especificação.

## Further Notes

O utilizador confirmou o entendimento e pediu a conversão para especificação através de `to-spec`. As decisões de arquivo, integração completa, apresentação por defeito e motores locais estão fechadas. A contagem e transcrição do tabuleiro de Y são trabalho técnico obrigatório durante a implementação, não uma escolha de produto pendente.

A edição é o 11.º CRJM do ano letivo 2026/27. A DRE anunciou a prova para 19 de fevereiro de 2027, com local ainda sujeito a confirmação. O nome do ficheiro da tabela não deve ser interpretado como ano da prova. [Ofício Circular n.º 126 da DRE](https://www.madeira.gov.pt/draece/pesquisar/ctl/ReadInformcao/mid/4170/InformacaoId/255868/UnidadeOrganicaId/32/LiveSearch/Pr%C3%A1tica%20Balnear).

Os documentos de referência fornecidos pelo utilizador são `Tabela_jogos_2026.jpg`, `Tabuleiro_Faisca_regras-1.docx` e `Tabuleiro_Y_regras-2.docx`. Cópias byte a byte ficam no conjunto de alterações local, em `docs/research/11crjm-sources/`, juntamente com a investigação e o glossário. A publicação desta issue não publica automaticamente esses ficheiros no GitHub; devem acompanhar a implementação. O grafo de Y deve ser transcrito do DOCX original.

Os DOCX são a referência para as variantes do campeonato. A interpretação das quatro direções e da abertura de Faísca tem suporte no mesmo exemplo das [regras originais de Joseph Kisenwether](https://web.archive.org/web/20080704121015/http://icehousegames.com/contest/icedes-3/synapse-ice/SI.htm), encontradas através da [Looney Labs](https://www.looneylabs.com/content/synapse-ice). Isso não autoriza importar outras variantes. A apresentação de [Y pela Kadon](https://www.gamepuzzles.com/tlog/tlog22.htm) auxilia a pesquisa, mas não substitui a validação do desenho fornecido.

Esta especificação mantém a decisão do núcleo de progresso centrado no aluno e associado ao jogo, registada na ADR-003. Não reabre decisões de plataforma anteriores nem cria um novo modelo de histórico de partidas.
