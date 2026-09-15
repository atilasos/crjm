# Aprender estratégias sem depender da jogada sugerida

Pesquisa em 2026-09-15. Contexto CRJM, alunos dos 7 anos ao secundário e sessões de cerca de 30 minutos. O professor escolheu uma primeira tentativa do aluno seguida de pistas graduais a pedido.

## Conclusão para o produto

A primeira melhoria deve mudar a relação entre aluno e tutor. Começar cada posição sem uma jogada recomendada visível, permitir uma tentativa, ajudar quando o aluno pede e verificar depois o que consegue fazer sozinho numa posição diferente. Melhorar a força do adversário é uma linha de trabalho separada.

O problema relatado pelo professor é compatível com comportamentos estudados em tutores digitais: conseguir avançar usando a ajuda sem adquirir a competência. É uma hipótese para este produto, não um diagnóstico individual dos alunos. A investigação justifica experimentar o novo percurso e medir a aprendizagem sem ajuda. Não permite afirmar antecipadamente que uma alteração de interface ensinará estratégias.

Recomendo uma alteração transversal do tutor e da evidência de progresso, aproveitando os motores existentes. Esta investigação pedagógica não identifica uma razão para reescrever os seis motores nem para iniciar novo treino na RTX como primeiro passo.

## O que mostram as fontes primárias

As aplicações ao CRJM abaixo são propostas de desenho. Nenhum dos estudos localizados avaliou esta aplicação ou os seis jogos em conjunto.

### 1. Concluir exercícios com ajuda pode esconder pouca aprendizagem

Baker e colegas observaram 70 alunos de aproximadamente 12–14 anos em cinco turmas. Pedir sucessivamente pistas até obter a resposta e experimentar respostas sistematicamente associou-se a piores resultados posteriores, mesmo controlando conhecimento inicial. O estudo é observacional; não demonstra que qualquer pedido de ajuda cause menor aprendizagem. [Artigo original, CHI 2004](https://www.cs.cmu.edu/~rsbaker/p383-baker-rev.pdf).

Aplicação proposta: distinguir uma escolha autónoma de uma escolha feita depois de a solução aparecer. Não classificar uma criança como desinteressada por clicar depressa ou pedir várias pistas.

### 2. O desempenho com IA e o desempenho sem IA são resultados diferentes

Bastani e colegas realizaram um ensaio aleatorizado com quase mil alunos do ensino secundário, numa escola na Turquia. O acesso a GPT-4 melhorou os resultados dos exercícios assistidos. No exame sem apoio, o grupo com a interface GPT Base teve notas 17% inferiores às do controlo. O GPT Tutor, com orientação para dar pistas e informação preparada por professores, mitigou em grande parte esse efeito negativo. Isso não equivale a demonstrar que este tutor melhora sempre a aprendizagem autónoma. [Artigo original, PNAS 2025](https://doi.org/10.1073/pnas.2422633122).

A correção publicada em agosto de 2025 altera uma afiliação institucional, não os resultados. [Correção](https://pmc.ncbi.nlm.nih.gov/articles/PMC12403119/).

Aplicação proposta: a medida principal do CRJM deve ser a resposta posterior sem tutor. Aumentar vitórias, XP ou rapidez durante treino não basta. A extrapolação para crianças de 7–10 anos e jogos de tabuleiro precisa de avaliação própria.

### 3. Explicar uma decisão pode ajudar a compreender e transferir

Em dois estudos em turmas com um tutor de geometria, Aleven e Koedinger encontraram melhor compreensão e desempenho em problemas de transferência quando os alunos explicavam os passos. O resultado pertence a tarefas de geometria e ao apoio específico daquele tutor; não valida qualquer pergunta genérica do tipo "porquê?". [Artigo original, Cognitive Science 2002](https://doi.org/10.1207/s15516709cog2602_1).

Aplicação proposta: pedir uma consequência verificável, por exemplo "Que espaço deixa esta jogada ao outro jogador?". Para os mais novos, aceitar apontar, comparar duas imagens ou explicar oralmente. Um clique numa frase correta pode ser uma pista útil para o professor, mas não prova por si que o aluno saberá jogar.

### 4. Retirar ajuda gradualmente é diferente de retirar toda a ajuda

Renkl, Atkinson e Maier compararam exemplos com passos gradualmente omitidos com pares de exemplo e problema. Um estudo em turmas do 9.º ano e outro com universitários encontraram vantagens na transferência próxima. Não encontraram uma vantagem estatisticamente significativa na transferência distante. [Artigo original, Cognitive Science Society 2000](https://escholarship.org/content/qt81b9j9hs/qt81b9j9hs_noSplash_ef3e30a960524adc5157ece2d6fa3130.pdf?t=reckzt).

Aplicação proposta: manter uma demonstração disponível para quem não sabe começar. Depois passar a completar uma decisão, comparar alternativas e resolver uma posição nova. Não transformar a primeira tentativa num tempo de espera obrigatório, nem exigir sucessivos erros para obter uma explicação.

### 5. A ajuda tem de depender do que se pretende aprender

Koedinger e colegas formulam o "dilema da assistência": dar informação e pedir ao aluno que a produza podem ambos ajudar ou prejudicar, dependendo da tarefa e do momento. É uma proposta teórica e de investigação, não uma fórmula validada para determinar uma percentagem ideal de dicas. [Artigo dos autores, Cognitive Science Society 2008](https://pact.cs.cmu.edu/pubs/Koedinger%2C%20Pavlik%2C%20McLaren%20%26%20Aleven%20CogSci08.pdf).

Aplicação proposta: uma criança que ainda desconhece a regra recebe uma demonstração; uma criança que já a usa recebe oportunidade para antecipar uma resposta adversária. O nível do adversário e a quantidade de ajuda do tutor precisam de controlos separados.

### 6. Variar a estratégia necessária tem evidência em matemática escolar

Um ensaio com 54 turmas do 7.º ano comparou prática intercalada e prática em blocos ao longo de quatro meses. Um mês depois da revisão comum, os resultados no teste foram 61% e 38%, respetivamente. Intercalar obrigava a escolher a estratégia adequada à questão. Estes valores não são uma previsão do efeito no CRJM. [Artigo original, Journal of Educational Psychology 2020, publicado online em 2019](https://uweb.cas.usf.edu/~drohrer/pdfs/Rohrer_et_al_2020JEdPsych.pdf).

Aplicação proposta: depois de aprender um padrão, misturar posições nas quais ele se aplica com outras nas quais é preciso outra estratégia. Não anunciar sempre "este é um exercício de bloqueio" antes de uma verificação autónoma.

### 7. Recordar mais tarde é útil, mas não dispensa ensinar como resolver

Roediger e Karpicke compararam reestudo de textos com testes de recordação. O reestudo teve vantagem imediata; os testes de recordação tiveram vantagem após dois dias ou uma semana. Trata-se de recordação de textos, não de aprendizagem de estratégias de jogo. [Estudo original, Psychological Science 2006](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/).

Em quatro experiências de resolução de problemas a partir de exemplos, van Gog e colegas não encontraram vantagem de testes de prática sobre reestudo para o desempenho posterior. Isso limita uma transposição automática do efeito anterior. [Estudo original, Educational Psychology Review 2015](https://link.springer.com/article/10.1007/s10648-015-9297-3).

Aplicação proposta: voltar a observar uma competência noutra sessão serve para verificar retenção. Combinar essa verificação com ensino, exemplos e feedback. Uma agenda fixa de 1/3/7 dias seria uma decisão de produto a testar, não uma prescrição universal destas fontes.

### 8. Aprender num jogo não garante melhoria geral em matemática

Siegler e Ramani encontraram ganhos em conhecimentos numéricos específicos de crianças em idade pré-escolar com um jogo de tabuleiro numérico linear. A representação e as tarefas do jogo estavam ligadas aos conhecimentos avaliados. O estudo não avaliou jogos abstratos de estratégia. [Estudo original, Journal of Educational Psychology 2009](https://siegler.tc.columbia.edu/wp-content/uploads/2019/02/sieg-ram09.pdf).

Num ensaio com 4009 crianças, o ensino de xadrez no Year 5, aos 9–10 anos, não produziu evidência de melhoria nos testes posteriores de matemática, leitura ou ciências. Esse resultado também não demonstra ausência de aprendizagem de xadrez. [Manuscrito original dos autores, 2017](https://johnjerrim.com/wp-content/uploads/2013/07/final_main_body.pdf), [publicação final, 2018](https://discovery.ucl.ac.uk/1556447/).

Aplicação proposta: definir primeiro o que o aluno deverá conseguir fazer no próprio jogo. Se se quiser avaliar contagem, simetria ou argumentação fora do jogo, acrescentar tarefas próprias para essas competências e medir separadamente.

## Prioridades de implementação

Estas decisões resultam da análise do problema e das fontes. Os valores operacionais propostos nesta secção precisam de calibração com os alunos.

### P0. A posição começa sem resposta exposta

- Iniciar cada novo turno em H0, sem casa recomendada, lista ordenada de melhores jogadas, coordenada no texto, variante principal ou anúncio acessível que revele a solução.
- Manter informação necessária para jogar: regras, orientação das peças, jogador atual e legalidade. Separar estes apoios das avaliações estratégicas do tutor.
- O aluno escolhe uma jogada ou pede ajuda. Pedir ajuda continua disponível; não há penalização de XP nem contagem decrescente para desbloquear a pista.
- Uma pista mostrada conta como exposição, mesmo que o aluno a feche antes de jogar. Registar o maior nível efetivamente visto na posição, em vez de apenas o nível visível no momento do clique.
- Reiniciar a exposição para a posição seguinte. Tratar regressos à mesma posição, incluindo undo/retry, como continuação da mesma oportunidade para efeitos de domínio.

### P0. Pistas que orientam uma operação mental

| Estado | O que o aluno vê | Ação intelectual pretendida |
|---|---|---|
| H0 | Tabuleiro e convite curto para escolher | Observar e propor |
| H1, a pedido | Pergunta sobre uma propriedade relevante | Contar, localizar, antecipar ou comparar |
| H2, a pedido | Região ou comparação limitada, sem apresentar uma opção como correta | Relacionar escolha e consequência |
| H3, a pedido | Demonstração concreta com consequência validada | Estudar um exemplo e preparar nova tentativa |

As letras não definem o grau real de ajuda. Uma região H2 com uma única jogada legal já revela a solução. O registo deve refletir essa exposição. Não reutilizar em H1 uma explicação produzida para a melhor jogada se mencionar as coordenadas ou a decisão a tomar.

Depois de H3, oferecer uma posição diferente sobre a mesma competência. Acertar novamente na posição cuja solução acabou de aparecer é prática assistida. Não deve atualizar o indicador de autonomia.

### P0. Progresso por evidência de competência

Separar os sinais seguintes na persistência e na interface:

| Sinal | O que permite concluir |
|---|---|
| Partidas, revisões abertas e XP | Participação em atividades |
| Jogada correta após pista | Desempenho com aquele apoio |
| Jogada legal sem pista | Conhecimento da legalidade naquela oportunidade |
| Decisão estratégica válida sem pista | Evidência local da competência identificada |
| Acerto em posição diferente noutra sessão | Evidência adicional de transferência próxima e retenção |
| Explicação observada pelo professor | Evidência sobre o raciocínio, dentro da tarefa observada |

Usar estados compreensíveis: "A explorar", "Com ajuda", "Sem ajuda" e "Confirmado noutra sessão". Mostrar a competência e as oportunidades observadas. Evitar uma percentagem de domínio aparentemente precisa quando há apenas um ou dois exemplos.

Proposta inicial para experimentar: marcar "Sem ajuda" após três primeiras respostas corretas em posições inéditas de pelo menos duas famílias; marcar "Confirmado noutra sessão" apenas depois de nova resposta correta sem pistas numa sessão posterior. Os números são um critério simples de produto, não um limiar cientificamente validado. Não apresentar esse estado como prova de domínio de todo o jogo.

H1 já é apoio estratégico. Guardar a informação para analisar a redução de ajuda, mas reservar a confirmação autónoma para H0. Um erro isolado posterior pede revisão e nova observação; não deve apagar automaticamente todas as conquistas anteriores.

### P1. Revisão com previsão e consequência

Escolher um momento curto da partida e apresentar a posição antes da jogada. Pedir a escolha ou a resposta adversária prevista antes de revelar a análise. Depois mostrar a consequência concreta e permitir comparar.

Aceitar várias jogadas válidas. Uma escolha diferente do primeiro resultado da IA não é automaticamente um erro. Para atribuir sucesso ou insucesso, usar um objetivo explícito verificável, como evitar captura imediata, conservar uma possibilidade ou ganhar um final resolvido. Quando o motor só oferece uma estimativa, comunicar essa condição e não converter a preferência em avaliação rígida do aluno.

Fechar com uma posição diferente e uma escolha independente. Uma simples rotação ou mudança de cor pode servir de primeiro exercício, mas não basta como única evidência de transferência.

### P1. Separar adversário, analista e tutor

- O adversário escolhe uma jogada dentro do nível de força contratado.
- O analista calcula consequências, alternativas aceitáveis e incerteza.
- O tutor decide o que mostrar ao aluno, quando mostrar e qual a competência a observar.

Não aumentar simultaneamente a força do adversário, o tamanho do problema e a autonomia exigida. Numa sequência didática, alterar uma dimensão de cada vez torna mais fácil perceber o que o aluno consegue fazer.

## Competências candidatas por jogo

São propostas para criar e validar posições de treino. Não são estratégias vencedoras demonstradas. A [investigação matemática existente](ESTRATEGIAS-MATEMATICAS.md) distingue os jogos resolvidos das variantes e posições sem solução publicada.

| Jogo | Primeira competência observável | Passo seguinte | Verificação sem ajuda |
|---|---|---|---|
| Gatos & Cães | Identificar casas legais e espaços que ficam indisponíveis | Comparar duas colocações pelo espaço restante | Escolher e indicar uma consequência numa posição nova |
| Dominório | Reconhecer encaixes possíveis para cada orientação | Identificar um corredor ou encaixe exclusivo | Resolver um pequeno final validado e prever a resposta |
| Quelhas | Aplicar a regra de perder com a última jogada | Antecipar a sequência num final curto | Escolher uma jogada num final resolvido com geometria diferente |
| Produto | Calcular o produto dos dois maiores grupos | Comparar crescimento e fusão de grupos | Escolher uma colocação pelo efeito calculável, incluindo efeito adversário |
| Atari Go | Contar liberdades e reconhecer captura imediata | Distinguir captura, defesa e ligação | Resolver uma captura/defesa inédita, sem marcações táticas |
| Nex | Distinguir objetivos de ligação e ações legais | Reconhecer ameaça imediata e uso de conversões | Impedir ou concluir uma ligação numa posição validada |

Evitar ensinar "joga sempre no centro", "par é bom" ou "junta os grupos" como regras universais. Uma explicação tem de sobreviver à simulação da posição e às regras da variante CRJM.

## Uma sessão de 30 minutos

O tempo total vem da indicação do professor. A divisão seguinte é uma proposta prática, ajustável à turma; não é um limite de atenção estabelecido pela investigação.

| Minutos | Atividade | Evidência |
|---|---|---|
| 0–3 | Uma ou duas posições sem ajuda sobre o padrão anterior | Retenção ou ponto de partida |
| 3–7 | Exemplo curto e objetivo da sessão | Compreensão inicial, sem atribuir domínio |
| 7–19 | Jogo ou conjunto de posições com primeira tentativa e pistas a pedido | Escolhas, dificuldades e apoio usado |
| 19–24 | Revisão de um momento e explicação ao colega/professor | Relação entre escolha e consequência |
| 24–28 | Posições inéditas, sem mostrar o nome do padrão procurado | Transferência próxima |
| 28–30 | Aluno escolhe o que quer voltar a praticar | Plano para a sessão seguinte |

Se o jogo continuar aos 19 minutos, guardar a posição e revê-la. Não obrigar a terminar uma partida longa para permitir a aprendizagem e a revisão. Se o aluno pedir ajuda durante uma verificação, ajudar e reclassificar a oportunidade como treino assistido.

| Faixa indicada pelo professor | Forma de resposta recomendada | Profundidade inicial a experimentar |
|---|---|---|
| 1.º ciclo, 7–10 | Apontar e dizer uma consequência; leitura breve; possibilidade de professor ler | Uma decisão e resposta imediata |
| 2.º ciclo, 11–12 | Comparar duas opções e completar "se…, então…" | Uma resposta adversária e revisão da escolha |
| 3.º ciclo, 12–15 | Explicar a ameaça e testar uma alternativa | Sequências táticas curtas |
| Secundário, mais de 15 | Comparar planos, procurar contraexemplo, discutir a estimativa da IA | Táticas e planos com pressupostos explícitos |

Estas faixas orientam a apresentação. Não justificam bloquear jogos por idade nem presumir capacidade a partir do ciclo escolar.

## Como demonstrar melhoria com os alunos

### Piloto com recursos de uma turma

1. Escolher uma competência de um jogo por grupo e preparar três conjuntos pequenos de posições diferentes, com dificuldade comparável: ponto de partida, avaliação imediata e avaliação posterior. O professor revê objetivos, soluções aceitáveis e linguagem.
2. Registar a primeira resposta sem ajuda antes do novo ensino. Distribuir os conjuntos entre alunos para não confundir facilidade de um conjunto com melhoria.
3. Realizar três sessões de cerca de 30 minutos com o percurso novo. Registar apoio pedido, respostas iniciais, exemplos vistos e interrupções técnicas.
4. Usar posições reservadas no fim do treino e na sessão seguinte, idealmente também cerca de uma semana depois. Guardar o intervalo real. Não reutilizar essas posições no treino entre avaliações.
5. Observar uma amostra de explicações orais com a mesma grelha simples: identifica o objetivo, prevê uma consequência válida e compara uma alternativa. Sempre que possível, rever algumas classificações com um segundo adulto.
6. Relatar quantos alunos melhoraram, mantiveram ou pioraram, além da média. Separar grupos e competências; não somar seis jogos numa pontuação que esconda o resultado de cada um.

Um antes/depois numa turma dá informação para melhorar o produto, mas mistura a intervenção com prática, contacto com o professor e passagem do tempo. Para uma conclusão causal, comparar grupos equivalentes com o mesmo tempo e ensino, com atribuição aleatória quando viável. Uma comparação faseada em que todos recebem o novo percurso pode ser mais simples na escola; continua a exigir atenção a diferenças de calendário e contaminação entre colegas.

### Medidas e leitura correta

| Medida | Definição operacional | Cuidado na interpretação |
|---|---|---|
| Acerto autónomo em transferência | Primeiras respostas corretas em posições reservadas, sem apoio estratégico | Usar soluções aceitáveis e registar dificuldade |
| Retenção | Acerto autónomo numa sessão posterior, noutras posições | Registar dias decorridos e oportunidades adicionais de treino |
| Qualidade da previsão | Consequência prevista corresponde ao que as regras permitem | Não pontuar qualidade da escrita como estratégia |
| Apoio necessário | Maior nível efetivamente mostrado antes da resposta, por competência | Pedir ajuda pode ser uma decisão apropriada |
| Dependência de revelação | Frequência de solução mostrada e desempenho autónomo posterior | Um decréscimo de H3 sozinho pode esconder alunos que desistiram |
| Participação | Atividades iniciadas/concluídas e continuação voluntária | XP e duração não medem diretamente aprendizagem |
| Experiência | Pedido de apoio ao professor, desistência observada e relato breve do aluno | Cliques rápidos ou pausas não identificam automaticamente frustração |

Definir antes do piloto qual a melhoria que justifica continuar. Uma proposta prática é procurar mais respostas autónomas corretas em posições inéditas, mantidas na sessão posterior, sem aumento claro de desistências ou pedidos de intervenção adulta. Apresentar contagens e incerteza; uma amostra pequena não sustenta alegações gerais de eficácia.

## Dados e validação necessários

Cada oportunidade precisa de jogo/variante, competência, identificador e versão da posição, família, sessão, primeira resposta, solução aceitável, apoio efetivamente exposto e resultado. A avaliação deve ser repetível a partir desses dados. Não contar cliques repetidos ou reabertura do mesmo exercício como novas confirmações.

Separar posições usadas para treino de posições reservadas para avaliação. Não tratar várias jogadas da mesma partida como alunos independentes. Se o computador for partilhado e a identidade do aluno não estiver estabelecida, apresentar progresso da sessão/dispositivo com essa descrição.

Uma decisão da IA pode ficar sem avaliação pedagógica quando faltar análise fiável. Melhor marcar "por observar" do que atribuir um erro estratégico a partir de uma busca interrompida ou de uma heurística instável.

## Uso útil da RTX

A RTX pode apoiar trabalho offline depois de definidos os objetivos:

- analisar partidas e procurar posições curtas com consequências claras;
- comparar alternativas e encontrar contraexemplos a explicações;
- produzir candidatos para exercícios de uma competência;
- testar adversários com estilos ou forças diferentes mantendo o objetivo didático;
- executar modelos de linguagem locais para rascunhar variantes de explicações, sempre limitadas aos factos fornecidos pelo motor.

Esses candidatos precisam de validação das regras, das soluções aceitáveis e da adequação pelo professor. O motor que gera um exercício não deve ser a única evidência da sua correção quando a posição permite verificação exata. Treinar uma rede para ganhar mais partidas não produz automaticamente um modelo do que cada aluno sabe. Não é necessário novo treino neural para corrigir a exposição da resposta, separar ajuda de autonomia e criar as primeiras verificações.

## Relação com a documentação existente

O [modelo pedagógico histórico](../agents/PEDAGOGY-MODEL.md) já prevê H0, exemplos, prática e retirada de apoio. Também descreve revisão que revela a alternativa antes da repetição e critérios de progresso sem separar claramente acerto ajudado de acerto autónomo. O novo percurso deve corrigir essa ambiguidade.

Os limites antigos de minutos, número de palavras, percentagens de acerto e fórmulas de dificuldade não recebem validação científica só por constarem desse documento. São escolhas de implementação. A duração e as faixas etárias usadas aqui refletem a indicação atual do professor.

## Limites e decisão seguinte

- Não foi localizado um ensaio do percurso proposto nos jogos CRJM. Há evidência relevante em tutores de matemática e aprendizagem de procedimentos, com idades e contextos diferentes.
- A autoexplicação e a transferência precisam de tarefas concretas e soluções verificadas. Uma caixa de texto ou a repetição de um slogan não implementam essas competências por si.
- O progresso no jogo, a aprendizagem curricular e o gosto por jogar são resultados distintos. Todos podem interessar ao professor, mas exigem medidas próprias.
- A primeira entrega deve demonstrar que nenhuma solução aparece antes do pedido, que a ajuda continua utilizável e que a progressão distingue exposição de autonomia. A melhoria pedagógica só pode ser confirmada com as respostas dos alunos em posições novas e numa sessão posterior.
