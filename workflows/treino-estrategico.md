# Treinar, prever e voltar a conseguir

Estado: piloto integrado em `main` e publicado em 2026-09-15. Ver [registo da publicação](../docs/deployment/2026-09-15-strategy-learning.md).

## Objetivo e utilizadores

Durante sessões de aproximadamente 30 minutos, ajudar os alunos a tomar decisões próprias nos seis jogos. O sinal de melhoria procurado é escolher e prever melhor sem soluções visíveis, incluindo numa sessão posterior.

Idades confirmadas: 7–10 / 11–12 / 12–15 / >15, conforme os ciclos associados ao jogo. As crianças podem explicar oralmente ou apontar. A verificação usa opções selecionáveis e não avalia escrita livre.

## Ciclo de uma sessão

Gatilho: aluno abre um jogo ou o Laboratório. O professor escolhe o jogo adequado ao ciclo e pode conduzir a sessão pela sequência seguinte, sem cronómetro obrigatório:

1. **3 minutos:** recordar uma ideia e fazer uma previsão sem ajuda.
2. **5 minutos:** comparar tentativas, pedir pistas ou estudar um exemplo.
3. **15 minutos:** jogar, propondo uma escolha e uma resposta possível do adversário.
4. **5 minutos:** verificar a ideia numa situação curta diferente no Laboratório.
5. **2 minutos:** partilhar o que mudou na leitura do tabuleiro e o que voltar a experimentar.

Esta distribuição é uma proposta operacional para os 30 minutos pedidos, não um resultado experimental sobre a duração ideal. O professor pode alterá-la sem mudar os critérios de evidência.

## Ciclo de um turno

- Começa em H0: pergunta para orientar observação e previsão; não apresenta posições da IA, ranking, coordenadas de resposta, ameaça resolvida ou legenda de recomendação.
- O aluno pode jogar diretamente. A reflexão é um convite, não um formulário obrigatório a cada jogada.
- Pedido de pista → H1, princípio do jogo; novo pedido → H2, comparar duas escolhas e consequências; novo pedido → H3, exemplo do motor com a explicação disponível.
- H1/H2/H3 contam como ajuda. A interface não promove automaticamente o nível da pista.
- Um novo turno volta a H0. Colocações parciais e cancelamento em Produto mantêm o apoio solicitado durante a ação composta. Pré-visualizações em Dominório/Nex não mudam o turno.
- Uma resposta antiga ou em cálculo não deve marcar posições no tabuleiro atual.
- A força selecionada do adversário continua separada da verificação dos fundamentos. As alternativas heurísticas do motor não certificam domínio.

## Ciclo de verificação

Gatilho: abrir **Escolhe e prevê** no Laboratório e escolher um jogo.

1. O servidor recupera a tentativa aberta da sessão existente ou cria a seguinte situação.
2. Apresenta enunciado, dados/diagrama, duas escolhas e três previsões; não envia solução, pista ou explicação antes do respetivo pedido.
3. O aluno seleciona uma escolha e uma previsão. A confirmação exige ambas.
4. Pode pedir uma pista a qualquer momento. O servidor regista a exposição antes de devolver o texto.
5. O servidor valida as duas respostas, grava a primeira submissão e devolve feedback. Alterar ou repetir a submissão não substitui a primeira tentativa.
6. O aluno compara a sua previsão com o que acontece e passa a outra situação. Não há recompensa adicional por repetir pedidos.
7. O perfil apresenta a competência fundamental observada e o próximo momento de verificação, separado de XP, vitórias e revisões.

### Fundamentos abrangidos pelo piloto

| Jogo | Objeto da verificação |
|---|---|
| Gatos & Cães | Contar reservas seguras e independentes, com condições explícitas |
| Dominório | Ler finais de reservas exclusivas independentes |
| Quelhas | Ler finais misère de bolsas isoladas de uma jogada |
| Produto | Comparar dois produtos quando se reforça um de dois grupos separados |
| Atari Go | Contar liberdades de grupos com formas diferentes e reconhecer captura imediata |
| Nex | Prever os três efeitos de substituição em linha, ramo e caminho com desvio |

Cada jogo tem 24 situações. Os diagramas compostos são posições de treino, sem alegação de que resultaram de uma partida real. Os enunciados de reservas delimitam a independência necessária; casas exclusivas em Gatos & Cães podem bloquear-se mutuamente.

## Progressão observável

- **Experimentar:** sem tentativas concluídas.
- **Praticar e comparar:** existe atividade, ainda sem três contextos e três famílias resolvidos sem apoio.
- **Já consegues sem ajuda:** três contextos distintos e pelo menos três famílias distintas; escolha e previsão corretas antes de explicação/pista.
- **Conseguiste novamente noutro dia:** nova resposta correta sem ajuda, pelo menos 24 horas após atingir o critério anterior.
- Um erro ou pedido de ajuda posterior mostra a necessidade de praticar; não apaga o histórico.
- Responder novamente à mesma situação logo após ajuda/erro nunca sobe o progresso. É possível voltar a demonstrar autonomia numa situação ensinada após 24 horas sem reexposição; cada contexto/família só contribui uma vez. Isto permite recuperação sem bloquear quem precisou de ajuda em todo o catálogo.
- Três famílias e 24 horas são parâmetros explícitos deste piloto; não são limiares de domínio cientificamente validados. A transferência distante para partidas completas ou matemática curricular precisa de observação própria.

## Persistência, falhas e compatibilidade

- Usar a identidade assinada do learner-core existente. A tentativa pertence a esse utilizador; outros utilizadores não a podem consultar ou responder.
- Uma única tentativa aberta por jogo/utilizador. Reabrir a página mantém a pista já pedida. Respostas duplicadas são idempotentes.
- Relógio do servidor para intervalos. O browser não declara que acertou nem qual o apoio usado.
- Se não houver ligação, apresentar falha e permitir repetir a mesma operação. Não mostrar progresso guardado sem confirmação. O modo estático sem learner-core não disponibiliza esta verificação persistente.
- Preservar XP e registos anteriores. Os contadores antigos deixam de ser apresentados como mestria. O catálogo antigo de perguntas explicadas é prática orientada.
- As decisões correntes dos motores e os seus limites continuam documentados na auditoria; esta mudança não constitui uma nova certificação de força dos adversários.
- Manter PT-PT, inglês e nepalês em todas as mensagens novas. Traduções para uso escolar devem passar pela revisão linguística habitual.

## Revisão pelo professor e conclusão

O checkpoint humano é a experimentação em turma, com a versão e os resultados técnicos preparados. Não há publicação automática.

Brief para o professor: alteração do comportamento da ajuda, resultado separado de prática/autonomia, seis fundamentos verificados, fontes e limitações, e ligação para abrir o piloto.

Critérios técnicos: seis jogos sem revelação H0/H1/H2; H3 disponível; mudança de turno elimina marcação; tentativas/pistas persistem; resposta errada não vira sucesso por retry; níveis exigem famílias distintas e intervalo; ausência de erros no browser e de overflow móvel; testes de regras, API e regressão.

Critério pedagógico a recolher: numa sequência de três sessões e reteste posterior, comparar a primeira escolha e a previsão sem ajuda, usando situações equivalentes diferentes, mais observação de decisões em partida. Separar por ciclo e experiência; não concluir aprendizagem a partir de XP, tempo, satisfação ou vitórias isoladas. Não declarar melhoria de aprendizagem antes dessa recolha.

## Próxima iteração após observação

Escolher a competência seguinte a partir dos erros e previsões observados. Para exercícios gerados pelo motor, conservar posição, ação, resposta adversária, profundidade/prova e versão; verificar legalidade e consequência antes da publicação. Utilizar RTX se esta análise ou geração realmente precisar dela, com benchmark separado da avaliação pedagógica.

Fontes e limites: [pesquisa pedagógica](../docs/research/strategy-learning-evidence.md), [auditoria técnica inicial](../docs/research/strategy-ai-and-progression-audit.md).
