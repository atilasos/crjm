# PEDAGOGY MODEL — CRJM Tutor Mode

Data de referência: 2026-03-18 (GMT+0)
Repo: `~/dev/crjm`

## 1) Objetivo

Definir um modelo pedagógico transversal para o modo tutor do CRJM que converta cada partida em aprendizagem ativa: progressão guiada, correção de erros recorrentes, feedback útil em tempo real, revisão pós-jogo e ajuste dinâmico da dificuldade (DDA) alinhado com a Zona de Desenvolvimento Proximal (ZPD).

O modelo alinha-se explicitamente com as **Aprendizagens Essenciais (AE)** de Matemática do currículo português e com os princípios do programa **MEM** (Movimento da Escola Moderna), servindo os ciclos 1.º ao Secundário com atenção especial ao 1.º Ciclo.

## 2) Enquadramento curricular

### 2.1 Aprendizagens Essenciais (AE) de Matemática

Os jogos do CRJM mobilizam quatro áreas transversais das AE:

| Área AE | Competência | Jogos que a mobilizam |
|---------|-------------|----------------------|
| Resolução de Problemas | Conceber e aplicar estratégias; analisar e validar resultados | Todos |
| Raciocínio Matemático | Formular conjeturas; justificar; generalizar | Produto, Nex, Dominório |
| Comunicação Matemática | Exprimir ideias e processos matemáticos oralmente e por escrito | Revisão pós-jogo (todos) |
| Pensamento Computacional | Decomposição; reconhecimento de padrões; abstração | Atari Go, Quelhas, Nex |

### 2.2 Competências específicas por ciclo

#### 1.º Ciclo (6-10 anos) — Gatos & Cães, Dominório, Quelhas

Aprendizagens Essenciais mobilizadas:
- **Números e Operações**: contagem (paridade em Dominório), comparação de quantidades (liberdades em Gatos & Cães).
- **Geometria e Medida**: orientação espacial, posição relativa, simetria (tabuleiros de todos os jogos).
- **Resolução de Problemas**: explorar regularidades; formular e testar conjeturas simples.
- **Raciocínio Matemático**: justificar escolhas com linguagem própria ("joguei aqui porque…").

Alinhamento MEM:
- **Trabalho cooperativo**: revisão pós-jogo como momento de comunicação e negociação de sentido.
- **Conselho de turma**: missões de aula como instrumento coletivo (cf. gamificação §6.3).
- **Ficheiros autocorretivos**: puzzles/drills com feedback imediato funcionam como ficheiros digitais.
- **Tempo de Estudo Autónomo (TEA)**: o modo tutor pode integrar-se no TEA como atividade estruturada com autonomia progressiva.

#### 2.º Ciclo (10-12 anos) — Dominório, Quelhas, Produto

- **Números e Operações**: produto de fatores, estimativa, cálculo mental (Produto).
- **Raciocínio dedutivo**: cadeia de consequências ("se jogo aqui, então ele…").
- **Organização e tratamento de dados**: análise do próprio histórico de erros na revisão.

#### 3.º Ciclo e Secundário (12-18 anos) — Produto, Atari Go, Nex

- **Pensamento algorítmico**: reconhecimento de heurísticas; noção intuitiva de árvore de jogo.
- **Geometria**: grafos e conexão (Nex), topologia básica (Atari Go).
- **Raciocínio hipotético-dedutivo**: "se ele ameaça X, qual é a melhor resposta?".

### 2.3 Adaptação ao 1.º Ciclo — princípios específicos

O 1.º Ciclo exige cuidados diferenciados:

1. **Linguagem**: frases curtas (máx. 12 palavras), vocabulário concreto, sem jargão técnico. Usar "tu" e tom encorajador.
2. **Duração das sessões**: máx. 15 minutos (não 25). Ciclo base adaptado: Aquecimento (2 min) → Jogo (5-8 min) → Revisão (3-4 min) → Fixação (2 min).
3. **Feedback visual > textual**: privilegiar destaques visuais (cores, setas, animações curtas) sobre texto escrito.
4. **Erro sem penalização percebida**: nunca mostrar "errado"; usar "e se tentasses…?" ou "olha o que acontece se…".
5. **Autonomia gradual**: nas Fases A-B, o tutor conduz quase tudo; nas Fases D-E, o aluno controla.
6. **Manipulação concreta**: quando possível, sugerir ao professor o uso do tabuleiro físico em paralelo (ponte digital-manipulativo, coerente com MEM).

### 2.4 Mapeamento jogo → competência AE (resumo operacional)

| Jogo | Ciclo | Competências AE prioritárias |
|------|-------|------------------------------|
| Gatos & Cães | 1.º | Orientação espacial, contagem, resolução de problemas |
| Dominório | 1.º-2.º | Paridade, raciocínio dedutivo, comunicação matemática |
| Quelhas | 1.º-3.º | Lógica inversa (misère), decomposição, pensamento computacional |
| Produto | 2.º-Sec | Produto, estimativa, raciocínio hipotético-dedutivo |
| Atari Go | 3.º-Sec | Pensamento computacional, grafos, raciocínio estratégico |
| Nex | Sec | Conexão/grafos, pensamento algorítmico, abstração |

## 3) Princípios pedagógicos

- **Aprendizagem por ciclos curtos**: observar → tentar → receber feedback → refazer.
- **Scaffolding explícito**: reduzir apoio gradualmente (worked examples → treino guiado → autonomia).
- **Erro como dado pedagógico**: classificar padrão de erro e prescrever intervenção específica.
- **Explicação mínima eficaz**: feedback curto, acionável e ligado ao estado do jogo.
- **Desafio ótimo (ZPD)**: evitar tanto frustração como automatismo sem esforço.
- **Metacognição progressiva**: a revisão pós-jogo ensina o aluno a pensar sobre o seu próprio pensamento — competência nuclear nas AE e no MEM.
- **Diferenciação**: o DDA garante que cada aluno trabalha ao seu nível, sem necessidade de turmas homogéneas.

## 4) Estrutura do modo tutor

### 4.1 Ciclo base por sessão

**1.º Ciclo (10-15 min):**
1. `Aquecimento` (2 min): 1 mini-puzzle visual simples.
2. `Jogo guiado` (5-8 min): partida com hints visuais e checkpoints.
3. `Revisão` (3-4 min): 1 turning point com "o que farias diferente?".
4. `Fixação` (2 min): 1 repetição do momento-chave.

**2.º Ciclo e acima (15-25 min):**
1. `Aquecimento` (2-3 min): 1 mini-puzzle do padrão que será treinado.
2. `Jogo guiado` (6-10 min): partida com hints progressivos e checkpoints.
3. `Revisão` (4-7 min): 1-3 turning points e alternativa melhor.
4. `Fixação` (3-5 min): 1 drill de repetição do erro principal detectado.

### 4.2 Progressão macro (por unidade)

1. **Fase A — Worked Examples**: exposição de 2-4 posições comentadas por jogo, com escolha forçada entre poucas jogadas.
2. **Fase B — Drills Guiados**: puzzles curtos com feedback imediato e hints em níveis.
3. **Fase C — Partida Assistida**: partidas completas com tutor ativo apenas em momentos críticos.
4. **Fase D — Partida com suporte mínimo**: hints apenas sob pedido e revisão obrigatória no final.
5. **Fase E — Consolidação**: misto de partida + 2 drills focados nos erros históricos do aluno.

### 4.3 Critério de progressão entre fases

Avança de fase quando, em janela de 5 sessões:
- taxa de acerto em decisões críticas >= 70%,
- repetição do mesmo erro crítico <= 2 ocorrências,
- tempo por decisão dentro da banda esperada do nível (+/- 40%).

Recua 1 fase quando, em 3 sessões consecutivas:
- acerto crítico < 45%, ou
- abandono frequente de hints após erro repetido (sinal de sobrecarga).

**Nota 1.º Ciclo**: a janela pode ser alargada para 7 sessões e o limiar de avanço reduzido para 60%, refletindo ritmos mais lentos de consolidação.

## 5) Taxonomia de erros por jogo (v1)

### 5.1 Gatos & Cães

| Código | Erro | Descrição |
|--------|------|-----------|
| E-GC-01 | Perda de centro | Ignora casas centrais no início |
| E-GC-02 | Mobilidade baixa | Escolhe jogada que reduz movimentos futuros |
| E-GC-03 | Bloqueio tardio | Não interrompe padrão de bloqueio adversário |

**Intervenção**: destacar mobilidade projetada em 1 jogada e mostrar alternativa central.
**Linguagem 1.º Ciclo**: "Olha quantos sítios tens para jogar a seguir! E se tentasses aqui no meio?"

### 5.2 Dominório

| Código | Erro | Descrição |
|--------|------|-----------|
| E-DO-01 | Quebra de paridade | Abre regiões com contagem desfavorável |
| E-DO-02 | Entrega de corredor | Cria sequência longa favorável ao adversário |
| E-DO-03 | Final mal gerido | Joga sem considerar últimas 4-8 peças |

**Intervenção**: drill de paridade e simulação curta de fim de jogo.
**Linguagem 1.º Ciclo**: "Conta as casas vazias — são pares ou ímpares? Isso muda tudo!"

### 5.3 Quelhas (misère)

| Código | Erro | Descrição |
|--------|------|-----------|
| E-QU-01 | Objetivo invertido | Joga como normal play |
| E-QU-02 | Isolamento mal avaliado | Cria ilha perdida sem necessidade |
| E-QU-03 | Última jogada forçada | Não evita sequência que o obriga a perder |

**Intervenção**: explicitar regra misère e mostrar "quem fica com a última" em preview.
**Linguagem 1.º Ciclo**: "Lembra-te: quem joga o último segmento perde! Consegues fazer o outro jogar por último?"

### 5.4 Produto

| Código | Erro | Descrição |
|--------|------|-----------|
| E-PR-01 | Ponte perdida | Não conecta grupos com alto ganho potencial |
| E-PR-02 | Fusão arriscada | Junta grupos cedo com perda de flexibilidade |
| E-PR-03 | Miopia de score | Otimiza ganho imediato e perde produto final |

**Intervenção**: comparar duas jogadas com score imediato vs score projetado.

### 5.5 Atari Go

| Código | Erro | Descrição |
|--------|------|-----------|
| E-AG-01 | Atari ignorado | Falha captura imediata |
| E-AG-02 | Grupo sem liberdades | Reduz o próprio grupo a 1 liberdade sem plano |
| E-AG-03 | Defesa passiva | Responde longe da ameaça principal |

**Intervenção**: destacar liberdades dos 2 grupos mais críticos antes da jogada.

### 5.6 Nex

| Código | Erro | Descrição |
|--------|------|-----------|
| E-NX-01 | Conexão quebrada | Não mantém caminho entre lados-alvo |
| E-NX-02 | Bloqueio tardio | Ignora ameaça de conexão adversária em 1-2 lances |
| E-NX-03 | Sobrevalorização local | Joga forte localmente sem impacto no caminho global |

**Intervenção**: visual de caminho mínimo (próprio vs adversário) e casa de corte.

## 6) Modelo de hints (scaffolding)

### 6.1 Níveis de hint

| Nível | Nome | Descrição | Exemplo 1.º Ciclo |
|-------|------|-----------|-------------------|
| H0 | Sem hint | Apenas validação de jogada legal | — |
| H1 | Direção | Orientação genérica sem revelar jogada | "Procura um sítio com mais espaço à volta" |
| H2 | Foco tático | Aponta região/ameaça sem dar jogada | "Olha para o canto de baixo — o adversário está quase a fechar!" |
| H3 | Sugestão explícita | Mostra 1-2 melhores jogadas e motivo curto | "Experimenta esta casa — assim ficas com mais caminhos livres" |

### 6.2 Regras de ativação de hint

- Erro crítico detectado → subir 1 nível de hint na jogada seguinte.
- 2 erros críticos seguidos no mesmo padrão → salto para H3 + mini-explicação.
- 3 decisões corretas seguidas no mesmo padrão → reduzir 1 nível de hint.
- Nunca manter H3 por mais de 4 jogadas seguidas (evitar dependência).

**Nota 1.º Ciclo**: o limite de H3 consecutivos pode ser alargado para 6, e a descida de nível só ocorre após 4 acertos (não 3), dando mais tempo de consolidação.

### 6.3 Template de feedback

Formato obrigatório (1-2 frases):
- "O que aconteceu" (facto do estado)
- "O que fazer a seguir" (ação concreta)

**Exemplo geral**: "Esta jogada deixou o teu grupo com 1 liberdade. Prioriza ligar ao grupo da esquerda para evitar captura no próximo lance."

**Exemplo 1.º Ciclo**: "O teu grupo ficou quase preso! Tenta juntá-lo ao grupo ali ao lado."

### 6.4 Regras de linguagem por ciclo

| Aspeto | 1.º Ciclo | 2.º Ciclo | 3.º Ciclo / Sec |
|--------|-----------|-----------|-----------------|
| Comprimento máx. | 12 palavras | 20 palavras | 30 palavras |
| Tom | Encorajador, lúdico | Direto, construtivo | Analítico, desafiante |
| Vocabulário | Concreto ("sítio", "casa") | Semi-técnico ("região", "paridade") | Técnico ("liberdade", "conexão mínima") |
| Tratamento | "Tu" | "Tu" | "Tu" (ou neutro) |
| Emojis/ícones | Sim, pontuais (estrela, seta) | Opcional | Não |

## 7) Revisão pós-jogo (obrigatória no modo tutor)

### 7.1 Seleção de turning points

Selecionar 1-3 momentos por partida:
- maior perda de avaliação local,
- erro crítico repetido,
- momento de viragem (ameaça não respondida).

**1.º Ciclo**: máximo 1 turning point por sessão, com apresentação visual (animação curta da sequência).

### 7.2 Fluxo de revisão

1. Mostrar posição e jogada realizada.
2. Mostrar melhor alternativa (`topMoves[0..1]`) com razão curta.
3. Propor "retry" imediato: aluno repete posição e escolhe de novo.
4. Se voltar a errar, apresentar hint H2/H3 e repetir uma última vez.

### 7.3 Fecho de sessão

- `Insight principal` (1 linha).
- `Erro-alvo da próxima sessão` (1 padrão).
- `Drill recomendado` (1 exercício curto).

**1.º Ciclo**: o fecho mostra apenas uma frase positiva + 1 desafio para a próxima vez ("Da próxima, tenta contar as casas antes de jogar!").

### 7.4 Ligação à metacognição (AE)

A revisão pós-jogo desenvolve diretamente a competência de **comunicação matemática** das AE:
- O aluno explica (mesmo que internamente) o porquê da sua jogada.
- Compara a sua decisão com a alternativa da IA.
- Formula conjeturas ("se tivesse jogado ali, teria ganho?").

No contexto MEM, a revisão equivale ao momento de **avaliação e regulação** do Conselho de Cooperação Educativa.

## 8) DDA/ZPD (regra operacional v1)

### 8.1 Sinais de entrada (janela móvel de 20 decisões)

- `criticalAccuracy`: % de decisões corretas em momentos críticos.
- `errorRepeatRate`: repetição do mesmo código de erro.
- `hintDependency`: proporção de jogadas com H3.
- `decisionTimeNorm`: tempo por decisão normalizado por nível/idade.
- `frustrationSignal`: sequência de erros + abandono/reinício.

### 8.2 Índice de desafio

```
challengeIndex = 0.40 × criticalAccuracy
               - 0.25 × errorRepeatRate
               - 0.20 × hintDependency
               - 0.15 × frustrationSignal
```

Interpretação:
- `>= 0.55`: abaixo da ZPD (fácil demais) → subir dificuldade.
- `0.35 a 0.54`: dentro da ZPD → manter.
- `< 0.35`: acima da ZPD (difícil demais) → reduzir dificuldade e aumentar scaffolding.

### 8.3 Ajuste por faixa etária

| Parâmetro | 1.º Ciclo | 2.º Ciclo | 3.º / Sec |
|-----------|-----------|-----------|-----------|
| Janela de decisões | 15 | 20 | 20 |
| Limiar ZPD superior | 0.60 | 0.55 | 0.55 |
| Limiar ZPD inferior | 0.30 | 0.35 | 0.35 |
| Peso frustrationSignal | 0.25 | 0.15 | 0.10 |
| Bloco de proteção (decisões) | 15 | 10 | 10 |

Racional: no 1.º Ciclo, a frustração tem maior peso porque crianças mais novas abandonam mais depressa; a janela é mais curta para reagir mais cedo; e o bloco de proteção é maior para dar estabilidade.

### 8.4 Ações de ajuste automático

Quando sobe dificuldade:
- aumentar profundidade/simulações em 10-20%,
- reduzir frequência de hints automáticos,
- aumentar proporção de puzzles transferidos (contexto novo).

Quando reduz dificuldade:
- diminuir profundidade/simulações em 10-20%,
- ativar hints mais cedo (H1/H2),
- inserir 1 worked example antes da próxima partida.

### 8.5 Guardrails

- Máximo 1 mudança de dificuldade por sessão.
- Após mudança, bloquear novo ajuste pelo bloco de proteção.
- Nunca alterar simultaneamente dificuldade e tipo de objetivo pedagógico.

## 9) Mapeamento para integração técnica (AIResponse v1)

Campos usados pelo tutor:
- `bestMove`, `topMoves`, `principalVariation`: suporte a hint/revisão.
- `criticalThreats`: gatilho para intervenção tática.
- `explainText`: texto base para feedback curto.
- `stats` (`elapsedMs`, `depth`, `simulations`, `usedWasm`): monitorização de dificuldade real.

Extensões pedagógicas recomendadas:
- `pedagogy.errorCode` (string): código da taxonomia de erros.
- `pedagogy.hintLevelSuggested` (H0-H3): nível de hint adaptado ao estado do aluno.
- `pedagogy.turningPointScore` (0-1): relevância do momento para revisão.
- `pedagogy.aeCompetency` (string[]): competências AE mobilizadas nesta jogada.

## 10) Integração com gamificação

O modelo pedagógico liga-se ao sistema de gamificação (ver `PEDAGOGY-GAMIFICATION.md`) nos seguintes pontos:
- **Achievements** reforçam competências AE específicas (ver mapeamento no documento de gamificação).
- **Cartões de padrões** funcionam como ficheiros autocorretivos digitais (princípio MEM).
- **Missões** estruturam a prática regular, alinhada com o TEA.
- **Progressão XP** torna visível o crescimento pessoal sem comparação forçada (coerente com avaliação formativa das AE).
- **Revisão pós-jogo** é a ação com maior recompensa XP — incentivando metacognição.

## 11) MVP de implantação (2-3 semanas)

1. Escolher jogo piloto (Dominório recomendado).
2. Implementar taxonomia de 3 erros críticos do piloto.
3. Ativar hints H1-H3 com regras de subida/descida.
4. Entregar revisão pós-jogo com 1-2 turning points.
5. Ligar DDA básico com `challengeIndex` e guardrails.
6. Implementar feedback com linguagem diferenciada por ciclo.

Critérios de aceite do MVP:
- >= 80% das partidas tutor terminam com revisão executada.
- Redução de >= 20% na repetição do erro crítico principal após 3 sessões.
- Progressão de dificuldade observável sem aumento de frustração.
- Feedback respeita as regras de linguagem do ciclo do aluno.

## 12) Próximos documentos derivados

- `docs/agents/PEDAGOGY-GAMIFICATION.md` — sistema de progressão/recompensa pedagógica
- `docs/agents/PUZZLES-POR-JOGO.md` — biblioteca de drills
- `docs/agents/DDA-RULES.md` — parâmetros detalhados por faixa etária
- `docs/agents/FEEDBACK-LANGUAGE-GUIDE.md` — tom e exemplos por ciclo
