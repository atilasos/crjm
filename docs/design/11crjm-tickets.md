# Tickets para a atualização do 11.º CRJM

Estado: divisão aprovada pelo utilizador e publicada no GitHub. Os números de ticket identificam a divisão aprovada; a tabela liga-os às issues reais.

Origem: [especificação #25](https://github.com/atilasos/crjm/issues/25), lida na íntegra, sem comentários adicionais em 17 de setembro de 2026. Os 13 tickets foram publicados com a etiqueta `ready-for-agent`; as 18 dependências nativas foram verificadas por leitura da API. A issue de origem permanece inalterada. [Registo de publicação](11crjm-ticket-publication.json).

O primeiro ticket é uma preparação que preserva comportamento. Os restantes acrescentam percursos demonstráveis de ponta a ponta. Idiomas, acessibilidade, persistência e testes acompanham cada percurso, em vez de ficarem para uma entrega horizontal posterior. A revisão final verifica a combinação dos percursos.

IA, tutor/Laboratório e torneios têm dependências distintas: o online precisa das regras e do tabuleiro local, mas não da IA; o Laboratório precisa dos níveis para validar as metas de partida, mas não do tutor dentro da partida. A ativação pública da nova edição depende de todas as áreas completas.

| Ticket | Issue | Entrega | Bloqueado por |
| --- | --- | --- | --- |
| 1 | [#26](https://github.com/atilasos/crjm/issues/26) | Preparar o catálogo partilhado sem alterar os jogos disponíveis | Nenhum |
| 2 | [#27](https://github.com/atilasos/crjm/issues/27) | Aceder ao arquivo jogável com aprendizagem, torneios e progresso | [#26](https://github.com/atilasos/crjm/issues/26) |
| 3 | [#28](https://github.com/atilasos/crjm/issues/28) | Jogar Faísca a dois e guardar o resultado | [#26](https://github.com/atilasos/crjm/issues/26) |
| 4 | [#29](https://github.com/atilasos/crjm/issues/29) | Jogar Y a dois no tabuleiro oficial e guardar o resultado | [#26](https://github.com/atilasos/crjm/issues/26) |
| 5 | [#30](https://github.com/atilasos/crjm/issues/30) | Treinar Faísca contra IA local com dificuldades verificadas | [#28](https://github.com/atilasos/crjm/issues/28) |
| 6 | [#31](https://github.com/atilasos/crjm/issues/31) | Treinar Y contra IA local com dificuldades verificadas | [#29](https://github.com/atilasos/crjm/issues/29) |
| 7 | [#32](https://github.com/atilasos/crjm/issues/32) | Pedir ajuda e rever decisões numa partida de Faísca | [#30](https://github.com/atilasos/crjm/issues/30) |
| 8 | [#33](https://github.com/atilasos/crjm/issues/33) | Pedir ajuda e rever decisões numa partida de Y | [#31](https://github.com/atilasos/crjm/issues/31) |
| 9 | [#34](https://github.com/atilasos/crjm/issues/34) | Aprender Faísca no Laboratório com progresso verificável | [#30](https://github.com/atilasos/crjm/issues/30) |
| 10 | [#35](https://github.com/atilasos/crjm/issues/35) | Aprender Y no Laboratório com progresso verificável | [#31](https://github.com/atilasos/crjm/issues/31) |
| 11 | [#36](https://github.com/atilasos/crjm/issues/36) | Disputar e acompanhar torneios online de Faísca | [#28](https://github.com/atilasos/crjm/issues/28) |
| 12 | [#37](https://github.com/atilasos/crjm/issues/37) | Disputar e acompanhar torneios online de Y | [#29](https://github.com/atilasos/crjm/issues/29) |
| 13 | [#38](https://github.com/atilasos/crjm/issues/38) | Ativar e verificar a edição completa do 11.º CRJM | [#27](https://github.com/atilasos/crjm/issues/27), [#32](https://github.com/atilasos/crjm/issues/32), [#33](https://github.com/atilasos/crjm/issues/33), [#34](https://github.com/atilasos/crjm/issues/34), [#35](https://github.com/atilasos/crjm/issues/35), [#36](https://github.com/atilasos/crjm/issues/36), [#37](https://github.com/atilasos/crjm/issues/37) |

## Cobertura da especificação

- Ticket 1: histórias 42.
- Ticket 2: histórias 4, 5, 6, 26, 27, 29, 31, 42.
- Ticket 3: histórias 7, 8, 12, 13, 14, 15, 16, 28, 29, 37, 38, 39, 40.
- Ticket 4: histórias 7, 8, 17, 18, 19, 20, 28, 29, 37, 38, 39, 40.
- Ticket 5: histórias 9, 10, 11, 41.
- Ticket 6: histórias 9, 10, 11, 41.
- Ticket 7: histórias 21, 22, 25.
- Ticket 8: histórias 21, 22, 25.
- Ticket 9: histórias 23, 24, 25, 28, 29.
- Ticket 10: histórias 23, 24, 25, 28, 29.
- Ticket 11: histórias 30, 32, 33, 34, 35, 36.
- Ticket 12: histórias 30, 32, 33, 34, 35, 36.
- Ticket 13: histórias 1, 2, 3, 30, 37, 38, 39, 40, 41, 42.

As 42 histórias estão cobertas. Os critérios da especificação continuam aplicáveis; os tickets não reduzem o âmbito. As cópias locais dos regulamentos e o glossário devem acompanhar o trabalho para que uma nova sessão consiga reproduzir as regras.

## Ticket 1: Preparar o catálogo partilhado sem alterar os jogos disponíveis

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno e o professor continuam a encontrar e usar os seis jogos existentes, enquanto início, aprendizagem, perfil e torneios passam a consultar a mesma identidade de jogo e seleção.

### Acceptance criteria

- [ ] Consolidar identidade, ciclos e pertença à seleção num catálogo partilhado pelos consumidores relevantes, preservando identificadores e ligações.
- [ ] Conservar o comportamento dos seis jogos em início, Laboratório, perfil, criação/administração de torneios e espectador.
- [ ] Remover o acoplamento que obriga um jogo recém-registado a fingir funcionalidades ainda não implementadas. Distinguir disponibilidade real dos percursos sem introduzir IA, conteúdos ou adaptadores fictícios.
- [ ] Permitir integrar uma funcionalidade de um novo jogo sem quebrar os outros percursos; disponibilização parcial durante desenvolvimento não equivale à entrega da edição.
- [ ] Manter a seleção anterior pública durante a integração até à ativação completa. Os novos percursos devem poder ser verificados na app sem os apresentar como uma edição pronta.
- [ ] Verificar os seis percursos atuais com os testes de sala de aula, contratos e persistência existentes; não criar uma nova plataforma nem mudar regras ou dados.

### Blocked by

Nenhum. Pode começar imediatamente.

## Ticket 2: Aceder ao arquivo jogável com aprendizagem, torneios e progresso

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno abre Gatos & Cães e Nex no Arquivo, continua os percursos e o progresso; o professor consegue escolher esses jogos para um torneio.

### Acceptance criteria

- [ ] Implementar a seleção explícita Arquivo no início, Laboratório e criação/administração de torneios; Gatos & Cães e Nex mantêm todas as funcionalidades.
- [ ] Preservar ligações antigas e indicar o contexto de arquivo, incluindo regresso à seleção correspondente.
- [ ] Conservar dois jogadores, computador, tutor, revisão, puzzles, percursos, torneios e espectador dos dois jogos.
- [ ] Verificar que perfis já persistidos e perfis legados importáveis conservam XP, conquistas, atividade e progresso, inclusive após nova sessão e importação repetida.
- [ ] Manter progresso por utilizador e jogo, sem duplicação nem reinício por edição. Arquivo não é histórico de partidas.
- [ ] Integrar o arquivo de forma verificável sem antecipar a troca pública para uma edição incompleta; a ativação final é tratada no ticket 13.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 1: Preparar o catálogo partilhado sem alterar os jogos disponíveis

## Ticket 3: Jogar Faísca a dois e guardar o resultado

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

Dois alunos completam uma partida local de Faísca segundo o regulamento, consultam as regras e encontram o resultado no progresso persistente do aluno.

### Acceptance criteria

- [ ] Usar tabuleiro 5×6, Azul primeiro e quinze peças por jogador: cinco de cada distância 1, 2 e 3.
- [ ] Permitir casa livre apenas na abertura. Depois, colocar na casa indicada; escolher peça disponível e uma das quatro direções ortogonais.
- [ ] Exigir destino vazio dentro do tabuleiro, também na abertura. Permitir saltos sobre casas intermédias ocupadas.
- [ ] Mostrar casa obrigatória, inventário, peça/direção selecionada e destino. Uma tentativa inválida não consome peças nem muda turno.
- [ ] Concluir a partida com derrota de quem não tem jogada válida ou peças; registar o resultado através do núcleo de progresso existente e verificar após nova sessão.
- [ ] Reproduzir o exemplo do regulamento por ações públicas, incluindo saltos, alvo final b3 e reservas indicadas na especificação #25.
- [ ] Disponibilizar regras e partida local pela via de integração preparada no ticket 1. Oferecer apenas os modos já implementados, sem placeholders para IA, aprendizagem ou torneios.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 1: Preparar o catálogo partilhado sem alterar os jogos disponíveis

## Ticket 4: Jogar Y a dois no tabuleiro oficial e guardar o resultado

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

Dois alunos completam uma partida local de Y no tabuleiro do anexo, podem trocar cores e veem o resultado atribuído ao jogador certo no perfil.

### Acceptance criteria

- [ ] Transcrever nós, ligações e pertença aos três lados a partir do DOCX original e comparar visualmente a representação jogável com o desenho. Registar a contagem validada sem assumir 93 ou 94 nós.
- [ ] Verificar a adjacência com casos que distingam linhas reais de pontos próximos. Não substituir o tabuleiro por uma grelha triangular regular.
- [ ] Colocar uma peça por turno numa intersecção vazia. Permitir a troca de cores apenas na primeira oportunidade do segundo jogador, em vez de uma colocação.
- [ ] Depois da troca, manter a peça inicial no lugar e fazer o primeiro jogador jogar com a outra cor. Mostrar claramente identidade, cor e turno.
- [ ] Vencer apenas com um único grupo ligado aos três lados. Verificar cantos em dois lados, ligação canto-lado oposto e grupos separados que não vencem.
- [ ] Guardar o resultado no núcleo de progresso, atribuindo a vitória ao participante certo depois de eventual troca; verificar numa nova sessão.
- [ ] Disponibilizar regras e partida local pela via de integração do ticket 1, sem anunciar modos ainda não implementados.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 1: Preparar o catálogo partilhado sem alterar os jogos disponíveis

## Ticket 5: Treinar Faísca contra IA local com dificuldades verificadas

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno escolhe uma dificuldade, joga uma partida completa de Faísca contra o computador e guarda o progresso correspondente ao nível.

### Acceptance criteria

- [ ] Implementar o adversário local usando as regras públicas de Faísca e a infraestrutura de IA existente, sem depender de um serviço de IA remoto.
- [ ] Completar partidas nos dois lados, respeitando inventário, alvo obrigatório, legalidade e resultado.
- [ ] Manter a interface utilizável durante o cálculo; reiniciar ou sair não pode aplicar uma resposta antiga a outra partida.
- [ ] Integrar seleção de dificuldade e registo de resultados por nível. Não prometer um número fixo de níveis ou equivalência com outros jogos.
- [ ] Avaliar diferenças de dificuldade com pelo menos 50 partidas por veredicto, aberturas emparelhadas, alternância de lados, seed e orçamento de tempo registados; guardar resultados e latências.
- [ ] Exigir zero jogadas ilegais e evidência antes de apresentar os níveis como progressivos. Executar arenas com orçamento de tempo em série.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 3: Jogar Faísca a dois e guardar o resultado

## Ticket 6: Treinar Y contra IA local com dificuldades verificadas

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno joga Y contra um computador local que respeita a troca de cores, escolhe dificuldades avaliadas e guarda o progresso por nível.

### Acceptance criteria

- [ ] Usar o grafo validado e as regras públicas de Y no motor local, sem serviço remoto de IA.
- [ ] Suportar humano e computador em ambos os lados, incluindo a decisão de trocar cores e a continuação correta após a troca.
- [ ] Completar partidas com o vencedor atribuído ao participante correto; integrar seletor de dificuldade e progresso por nível.
- [ ] Manter a interface utilizável e impedir que cálculos de uma partida anterior alterem a partida atual.
- [ ] Avaliar cada veredicto de dificuldade com pelo menos 50 partidas, aberturas emparelhadas, alternância de lados, seed, orçamento de tempo, resultados e latências registados.
- [ ] Exigir zero jogadas ilegais e suporte empírico para dificuldades progressivas. Não fixar antecipadamente o número de níveis ou prometer força de campeão. Serializar arenas com orçamento de tempo.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 4: Jogar Y a dois no tabuleiro oficial e guardar o resultado

## Ticket 7: Pedir ajuda e rever decisões numa partida de Faísca

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

Durante uma partida de Faísca, o aluno pede ajudas graduais; no fim, revê uma decisão relevante e guarda essa atividade.

### Acceptance criteria

- [ ] Integrar o tutor existente com contexto do turno, inventário, próxima casa e consequências das escolhas.
- [ ] Começar sem revelar a solução; respeitar os pedidos de princípio, comparação e exemplo completo.
- [ ] Coordenadas, destaques e ordenação de soluções só aparecem na etapa adequada, sem uma superfície paralela que revele a resposta mais cedo.
- [ ] Produzir uma revisão pós-partida a partir de uma decisão real e legal, distinguindo avaliação heurística de consequência demonstrada.
- [ ] Registar ajuda e revisão pelo mecanismo existente; a exposição a ajuda não deve desaparecer com recarregamento ou ser apresentada como autonomia.
- [ ] Verificar turno novo, reinício, partida terminada e nova sessão; a revisão incrementa o progresso apropriado sem duplicar recompensa.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 5: Treinar Faísca contra IA local com dificuldades verificadas

## Ticket 8: Pedir ajuda e rever decisões numa partida de Y

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno pede ajuda sobre ligações e lados em Y e revê uma decisão da própria partida, com progresso e cores corretos.

### Acceptance criteria

- [ ] Integrar o tutor com o grafo validado, grupos, lados e atribuição de cores aos participantes.
- [ ] Aplicar as etapas existentes de ajuda sem mostrar previamente coordenadas, ligações resolvidas ou ordenação de jogadas.
- [ ] A troca de cores deve manter coerentes a perspetiva do aluno, a análise e o registo da revisão.
- [ ] Construir a revisão a partir de uma decisão real; distinguir recomendações do motor de vitórias ou consequências demonstradas.
- [ ] Persistir exposição a ajuda e atividade de revisão pelo mecanismo existente, conservando a distinção entre prática e autonomia.
- [ ] Verificar reinício, turno novo, recarregamento e nova sessão sem revelar resposta antecipada ou duplicar recompensa.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 6: Treinar Y contra IA local com dificuldades verificadas

## Ticket 9: Aprender Faísca no Laboratório com progresso verificável

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno segue o percurso de Faísca, resolve puzzles e situações de escolha e previsão e acompanha evidência de aprendizagem no perfil.

### Acceptance criteria

- [ ] Disponibilizar o percurso nas etapas existentes, com puzzles, desafios de partida e metas por dificuldade ligadas ao progresso real.
- [ ] Criar situações de escolha e previsão sobre regras e decisões de Faísca com consequências verificadas pelas ações públicas do jogo.
- [ ] Usar famílias de situações distintas e conservar os critérios existentes de autonomia, recuperação diferida e exposição a ajuda; variações cosméticas não equivalem a famílias novas.
- [ ] Persistir respostas, pistas e elegibilidade das novas tentativas no mecanismo atual, incluindo a espera existente de 24 horas quando aplicável.
- [ ] Uma resposta correta após erro ou pista conta segundo a política atual de prática orientada, também após recarregamento.
- [ ] Verificar o percurso completo do exercício até ao perfil e as metas de partidas contra os níveis locais. Este ticket não depende do tutor dentro da partida.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 5: Treinar Faísca contra IA local com dificuldades verificadas

## Ticket 10: Aprender Y no Laboratório com progresso verificável

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O aluno aprende ligação aos três lados e troca de cores em puzzles e exercícios de Y, com progresso persistente no percurso.

### Acceptance criteria

- [ ] Disponibilizar o percurso com as etapas existentes, puzzles e desafios contra os níveis locais, refletindo resultados reais.
- [ ] Construir exercícios no grafo validado sobre adjacência, grupos, lados/cantos e troca, sem diagramas de uma variante diferente.
- [ ] Verificar escolhas e previsões pelas regras públicas; afirmações de vitória forçada exigem prova adequada, não apenas preferência do motor.
- [ ] Usar famílias distintas e aplicar as regras atuais de autonomia, pistas, erros, recuperação diferida e espera de 24 horas quando aplicável.
- [ ] Preservar a primeira tentativa e exposição a ajuda após recarregar; impedir que tentativas repetidas inflem a evidência de autonomia.
- [ ] Demonstrar exercício, resultado persistido, progressão e perfil. Este ticket não depende do tutor dentro da partida.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 6: Treinar Y contra IA local com dificuldades verificadas

## Ticket 11: Disputar e acompanhar torneios online de Faísca

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O professor cria um torneio de Faísca; os alunos jogam, recuperam de uma desconexão e o professor e espectadores acompanham a mesma partida.

### Acceptance criteria

- [ ] Integrar a escolha de Faísca e as suas ações no cliente, servidor, administração e espectador do torneio existente.
- [ ] Validar no servidor jogador, turno, inventário, casa obrigatória, orientação e destino segundo as mesmas regras do modo local.
- [ ] Rejeitar ações inválidas sem alterar estado ou aceitar o cliente como autoridade.
- [ ] Reconectar com tabuleiro, reservas, próxima casa, turno e resultado consistentes; ações repetidas não podem criar uma jogada adicional.
- [ ] Concluir uma partida e atualizar o torneio de dupla eliminação, preservando as operações existentes de administração.
- [ ] Comparar sequências locais e online e demonstrar um torneio real com participantes e espectador. Não depende da IA nem do Laboratório.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 3: Jogar Faísca a dois e guardar o resultado

## Ticket 12: Disputar e acompanhar torneios online de Y

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

O professor cria um torneio de Y; os alunos colocam ou trocam cores, reconectam e terminam a partida perante administração e espectadores.

### Acceptance criteria

- [ ] Integrar Y no cliente, servidor, administração e espectador com o grafo validado.
- [ ] O servidor valida colocações, turno e a oportunidade única de troca. Manter a mesma legalidade e vitória do modo local.
- [ ] Sincronizar a atribuição de cores sem mudar a identidade dos participantes. Após troca, turno e eventual vencedor ficam corretos em todos os clientes.
- [ ] Reconectar antes e depois de uma troca conservando tabuleiro, oportunidade de troca, cores, turno e resultado; duplicação de mensagens não duplica ações.
- [ ] Concluir a partida e atualizar o torneio de dupla eliminação com o vencedor correto.
- [ ] Comparar sequências locais e online e demonstrar um torneio real com participantes e espectador. Não depende da IA nem do Laboratório.
- [ ] Preservar os seis jogos existentes e os dados dos alunos; verificar comportamento observável, sem testes dependentes de funções privadas.
- [ ] Incluir os textos do percurso em PT-PT, inglês e nepalês, os temas existentes e controles acessíveis em computador, tablet e telemóvel.
- [ ] Estender os testes existentes pertinentes e demonstrar o percurso na app em execução; usar Agent Browser Hub com perfil research e fechar a sessão.

### Blocked by

- Ticket 4: Jogar Y a dois no tabuleiro oficial e guardar o resultado

## Ticket 13: Ativar e verificar a edição completa do 11.º CRJM

### Parent

https://github.com/atilasos/crjm/issues/25

### What to build

A app apresenta a edição atual completa e o arquivo, com oito jogos utilizáveis e todos os percursos e dados preservados, pronta para revisão da atualização.

### Acceptance criteria

- [ ] Ativar a seleção pública do 11.º CRJM 2026/27 apenas quando Faísca e Y tiverem todos os modos e áreas acordados.
- [ ] Verificar os seis jogos atuais e os ciclos exatos da especificação: Dominório apenas 1.º; Faísca 1.º/2.º; Quelhas 1.º/2.º/3.º; Produto 2.º/3.º/secundário; Atari Go 3.º/secundário; Y secundário.
- [ ] Confirmar edição atual por defeito no início, Laboratório e criação de torneios, com acesso explícito a Gatos & Cães e Nex no Arquivo.
- [ ] Demonstrar os oito jogos e a preservação de progresso antigo, ligações, aprendizagem, modos locais, IA e torneios.
- [ ] Executar a regressão completa, verificações de sala de aula e progresso persistente, idiomas e build. Comparar falhas preexistentes sem as apresentar como regressões novas.
- [ ] Verificar computador, tablet e telemóvel, temas, PT-PT/inglês/nepalês e controles acessíveis; corrigir incompatibilidades entre as entregas.
- [ ] Reunir evidência das arenas locais e das verificações dos tabuleiros/regras e atualizar a documentação do produto para a seleção correta.
- [ ] A conclusão é uma atualização local pronta para revisão, sem publicar em produção, fechar ou alterar a issue de especificação #25.

### Blocked by

- Ticket 2: Aceder ao arquivo jogável com aprendizagem, torneios e progresso
- Ticket 7: Pedir ajuda e rever decisões numa partida de Faísca
- Ticket 8: Pedir ajuda e rever decisões numa partida de Y
- Ticket 9: Aprender Faísca no Laboratório com progresso verificável
- Ticket 10: Aprender Y no Laboratório com progresso verificável
- Ticket 11: Disputar e acompanhar torneios online de Faísca
- Ticket 12: Disputar e acompanhar torneios online de Y
