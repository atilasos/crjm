# PEDAGOGY-GAMIFICATION — Sistema de Progressão Pedagógica do CRJM

Data de referência: 2026-03-18 (GMT+0)
Repo: `~/dev/crjm`
Documento-pai: `docs/agents/PEDAGOGY-MODEL.md`

## 1) Objetivo

Especificar o sistema de gamificação do CRJM enquanto **camada pedagógica**, não decorativa. Cada elemento de gamificação (XP, achievements, cartões, missões) existe para reforçar competências concretas das Aprendizagens Essenciais (AE) de Matemática e princípios do MEM (Movimento da Escola Moderna).

Princípio orientador: **a gamificação torna visível a aprendizagem invisível**.

## 2) Princípios de design pedagógico

1. **Aprendizagem > vitória**: a revisão pós-jogo vale mais XP do que ganhar.
2. **Progressão pessoal > comparação**: sem leaderboard global por defeito; o aluno compete consigo mesmo.
3. **Recompensar o processo**: tentativa, revisão, melhoria e consistência geram XP, não apenas resultados.
4. **Metacognição como prémio**: os melhores achievements exigem reflexão, não repetição mecânica.
5. **Sem penalização**: nunca retirar XP ou achievements; a progressão é monótona crescente.
6. **Coerência com avaliação formativa**: o sistema reflete os princípios de avaliação das AE (formativa, contínua, reguladora).

## 3) Mapeamento achievements → competências AE

### 3.1 Achievements de onboarding

| Achievement | Descrição | Competência AE reforçada |
|-------------|-----------|--------------------------|
| `first_game` — Primeiro Jogo | Completou a primeira partida | Resolução de problemas: envolver-se na tarefa |
| `first_win` — Primeira Vitória | Ganhou pela primeira vez | Resolução de problemas: aplicar estratégia |
| `first_review` — Primeira Revisão | Completou 1 revisão pós-jogo | Comunicação matemática: refletir sobre o processo |
| `first_puzzle` — Primeiro Puzzle | Resolveu 1 puzzle/drill | Raciocínio matemático: analisar situação e decidir |

### 3.2 Achievements de aprendizagem transversal

| Achievement | Descrição | Competência AE reforçada |
|-------------|-----------|--------------------------|
| `top3_move` — Pensador | Escolheu jogada no top 3 da IA | Resolução de problemas: conceber estratégias eficazes |
| `after_hint_recovery` — Sem Medo | Corrigiu erro após hint | Raciocínio matemático: reformular conjeturas |
| `three_clean_games` — Estratega | 3 jogos sem erro de regra | Pensamento computacional: executar procedimentos corretamente |
| `review_streak_3` — Refletor | 3 revisões completas consecutivas | Comunicação matemática: desenvolver hábito metacognitivo |
| `comeback_win` — Recuperação | Venceu após posição difícil | Resolução de problemas: persistência e adaptação |
| `explain_move` — Explicador | Articulou razão para jogada (futuro: voz/texto) | Comunicação matemática: exprimir raciocínio |
| `pattern_collector_5` — Colecionador | Desbloqueou 5 cartões de padrão | Raciocínio matemático: reconhecer regularidades |
| `improvement_streak` — Em Crescimento | Melhorou challengeIndex em 3 sessões seguidas | Autorregulação: monitorizar e ajustar a própria aprendizagem |

### 3.3 Achievements de consistência

| Achievement | Descrição | Competência AE reforçada |
|-------------|-----------|--------------------------|
| `daily_streak_3` — 3 Dias | Treinou 3 dias seguidos | Disposição: persistência na prática |
| `daily_streak_7` — Semana Completa | Treinou 7 dias seguidos | Disposição: autonomia e responsabilidade |
| `weekly_mission` — Missão Cumprida | Completou missão semanal | Resolução de problemas: planificar e cumprir objetivos |

### 3.4 Achievements por jogo → competências específicas

#### Gatos & Cães (1.º Ciclo)

| Achievement | Competência AE |
|-------------|---------------|
| `center_keeper` — Dono do Centro | Geometria: posição relativa; orientação espacial |
| `block_master` — Mestre do Bloqueio | Raciocínio: antecipar consequências de uma ação |

#### Dominório (1.º-2.º Ciclo)

| Achievement | Competência AE |
|-------------|---------------|
| `parity_guardian` — Guardião da Paridade | Números: par/ímpar; contagem estratégica |
| `last_move_master` — Última Peça | Raciocínio dedutivo: cadeia de consequências |
| `opening_reader` — Leitor de Aberturas | Resolução de problemas: planificar antes de agir |

#### Quelhas (1.º-3.º Ciclo)

| Achievement | Competência AE |
|-------------|---------------|
| `misere_mind` — Mestre Misère | Raciocínio: inversão lógica; compreender regras não-standard |
| `endgame_architect` — Arquiteto do Fim | Pensamento computacional: decomposição do problema |

#### Produto (2.º Ciclo - Sec)

| Achievement | Competência AE |
|-------------|---------------|
| `balanced_builder` — Equilíbrio Perfeito | Números: produto, estimativa, cálculo mental |
| `elegant_saboteur` — Sabotador Elegante | Raciocínio estratégico: otimizar resultado global vs local |

#### Atari Go (3.º Ciclo - Sec)

| Achievement | Competência AE |
|-------------|---------------|
| `atari_hunter` — Caçador de Liberdades | Pensamento computacional: reconhecimento de padrões |
| `double_atari` — Duplo Atari | Raciocínio: explorar múltiplas ameaças simultâneas |
| `ladder_spotter` — Leitor de Escadas | Pensamento algorítmico: reconhecer sequência forçada |

#### Nex (Secundário)

| Achievement | Competência AE |
|-------------|---------------|
| `bridge_builder` — Construtor de Pontes | Geometria: grafos e conexão |
| `triple_threat` — Tripla Ameaça | Raciocínio hipotético-dedutivo: ramificação de possibilidades |

## 4) Cartões de padrões estratégicos — função pedagógica

### 4.1 O que são

Cada cartão representa um **padrão estratégico** concreto de um jogo. Os cartões funcionam como **ficheiros autocorretivos digitais** (conceito MEM): o aluno descobre, aplica, é corrigido e gradualmente domina.

### 4.2 Estados do cartão e o que significam pedagogicamente

| Estado | Descrição | Significado pedagógico | Ligação AE |
|--------|-----------|----------------------|------------|
| 🔒 Bloqueado | Não encontrado ainda | — | — |
| 👁️ Visto | Apareceu em revisão pós-jogo ou hint | Exposição: o aluno viu o padrão em contexto | Resolução de problemas: compreender |
| 🛠️ Usado com ajuda | Aplicou o padrão após hint H2/H3 | Prática guiada: scaffold ativo | Raciocínio: aplicar com suporte |
| ✅ Usado sozinho | Aplicou sem hint, reconhecido pela IA | Autonomia: transferência | Raciocínio: generalizar |
| ⭐ Dominado | Aplicou em 3+ contextos diferentes sem ajuda | Mestria: consolidação | Pensamento computacional: abstração |

### 4.3 Ligação à revisão pós-jogo

A revisão é o momento principal de **desbloqueio e progressão** de cartões:

1. Se o turning point envolve um padrão → o cartão é mostrado (transição para "Visto").
2. Se no retry o aluno aplica o padrão com hint → transição para "Usado com ajuda".
3. Se aplica sem hint → transição para "Usado sozinho".

Isto torna a revisão intrinsecamente recompensadora: não é só "ver o que fiz mal", é **colecionar conhecimento**.

### 4.4 Catálogo de cartões por jogo

#### Atari Go
| Cartão | Padrão | Nível mínimo |
|--------|--------|-------------|
| `atari` | Grupo com 1 liberdade — ameaça de captura | Fase A |
| `ladder` | Sequência forçada de atari em escada | Fase B |
| `net` | Captura por envolvimento sem atari direto | Fase C |
| `double-atari` | Dois grupos ameaçados em simultâneo | Fase C |
| `snapback` | Sacrifício que recupera pedras | Fase D |

#### Dominório
| Cartão | Padrão | Nível mínimo |
|--------|--------|-------------|
| `paridade` | Controlo de par/ímpar em regiões | Fase A |
| `corte` | Dividir o tabuleiro em zonas independentes | Fase B |
| `corredor` | Sequência forçada de peças | Fase C |
| `espelhamento` | Estratégia de simetria | Fase D |

#### Quelhas
| Cartão | Padrão | Nível mínimo |
|--------|--------|-------------|
| `misere-final` | Quem joga último perde — planear de trás para a frente | Fase A |
| `simetria` | Espelhar jogadas do adversário | Fase B |
| `fratura` | Separar grafo em componentes desconexas | Fase C |
| `isolamento-forçado` | Forçar adversário a jogar sozinho numa região | Fase D |

#### Produto
| Cartão | Padrão | Nível mínimo |
|--------|--------|-------------|
| `equilibrio` | Manter grupos de tamanho semelhante | Fase A |
| `fusao-adversaria` | Forçar adversário a fundir grupos subótimos | Fase B |
| `grupo-isolado` | Proteger grupo com alto potencial de produto | Fase C |

#### Nex
| Cartão | Padrão | Nível mínimo |
|--------|--------|-------------|
| `ponte` | Ligação virtual entre peças com 2 caminhos | Fase A |
| `ameaca-dupla` | Dois caminhos de conexão simultâneos | Fase B |
| `tripla-ameaca` | Forçar conexão impossível de bloquear | Fase C |
| `bloqueio-central` | Cortar caminho mínimo adversário no centro | Fase C |

#### Gatos & Cães
| Cartão | Padrão | Nível mínimo |
|--------|--------|-------------|
| `centro` | Controlar casas centrais na abertura | Fase A |
| `casa-em-disputa` | Identificar casas com valor para ambos os jogadores | Fase B |
| `jogada-garantida` | Casa que apenas um jogador pode ocupar | Fase C |

## 5) Missões — estrutura pedagógica

### 5.1 Princípio

As missões não são tarefas arbitrárias: cada uma exercita uma **competência específica** e guia o aluno para práticas de alto valor pedagógico.

### 5.2 Missões diárias

| Missão | O que pratica | Competência AE |
|--------|--------------|---------------|
| "Joga 2 partidas" | Volume de prática | Resolução de problemas: envolvimento |
| "Faz 1 revisão completa" | Metacognição | Comunicação matemática: refletir |
| "Resolve 2 puzzles" | Raciocínio tático | Raciocínio matemático: analisar |
| "Usa no máximo 2 hints" | Autonomia progressiva | Autorregulação |

### 5.3 Missões semanais

| Missão | O que pratica | Competência AE |
|--------|--------------|---------------|
| "Completa 5 revisões" | Hábito metacognitivo | Comunicação matemática |
| "Ganha em 2 jogos diferentes" | Transferência de competências | Resolução de problemas: generalizar |
| "Desbloqueia 3 cartões" | Reconhecimento de padrões | Raciocínio: identificar regularidades |
| "Sobe 1 barra de estratégia" | Crescimento deliberado | Autorregulação e persistência |

### 5.4 Missões de aula (contexto MEM)

As missões de aula alinham-se com o **Conselho de Cooperação Educativa** e o **Plano Individual de Trabalho (PIT)** do MEM:

| Missão | Ligação MEM | Competência AE |
|--------|------------|---------------|
| "Toda a turma completa 10 revisões" | Projeto coletivo do Conselho | Comunicação: responsabilidade partilhada |
| "Resolver 15 puzzles de Atari Go" | Ficheiro coletivo | Resolução de problemas em grupo |
| "80% da turma sem erros de regra em Dominório" | Meta coletiva de qualidade | Pensamento computacional: rigor |
| "Cada aluno ensina 1 padrão a um colega" | Ensino recíproco | Comunicação matemática: explicar |

### 5.5 Integração com TEA (Tempo de Estudo Autónomo)

No contexto MEM, o CRJM pode integrar-se no TEA como ficheiro digital:
- O aluno escolhe o jogo no seu PIT.
- As missões diárias estruturam o trabalho autónomo.
- A revisão pós-jogo é o momento de autoavaliação.
- O professor consulta o painel de progresso (barras Regras/Estratégia/Mestria) como substituto do registo manual.

## 6) XP e progressão — lógica pedagógica

### 6.1 Tabela de XP e justificação

| Ação | XP | Porquê este valor |
|------|-----|-------------------|
| Completar partida | +10 | Recompensar conclusão, não abandono |
| Vitória | +8 | Menor que revisão — a vitória não é o objetivo principal |
| Revisão pós-jogo completa | +10 | Ação com maior valor pedagógico — igual a completar partida |
| Puzzle resolvido | +6 | Prática focada de raciocínio |
| Melhoria face à sessão anterior | +5 | Reforço de crescimento pessoal |
| Streak diário | +3 | Consistência de prática |
| Achievement desbloqueado | +5 a +20 | Marcos de competência |
| Cartão de padrão avançado | +3 por transição | Recompensar aprofundamento |

**Nota**: a revisão completa (10 XP) vale mais que a vitória (8 XP). Isto é intencional: o sistema comunica que **refletir é mais valioso do que ganhar**.

### 6.2 Níveis e títulos

| Nível | XP necessário | Título |
|-------|--------------|--------|
| 1 | 0 | Explorador |
| 2 | 50 | Aprendiz |
| 3 | 120 | Estratega |
| 4 | 220 | Desafiador |
| 5 | 360 | Campeão |
| 6+ | 550+ | Mestre em Formação |

Os títulos são progressivos e nunca se perdem. Usar linguagem neutra e acessível ao 1.º Ciclo.

### 6.3 Eixos de progressão por jogo

Cada jogo mostra 3 barras de progressão:

| Barra | O que mede | Sobe quando... | Competência AE |
|-------|-----------|----------------|---------------|
| **Regras** | Domínio das regras | Reduz jogadas ilegais; termina jogos corretamente | Pensamento computacional: rigor procedimental |
| **Estratégia** | Qualidade das decisões | Escolhe top 3; reconhece ameaças; resolve puzzles | Raciocínio matemático: conjeturar e validar |
| **Mestria** | Autonomia e reflexão | Faz revisões; melhora challengeIndex; joga sem hints | Autorregulação; comunicação matemática |

## 7) Regras anti-frustração

Estas regras são essenciais para o 1.º Ciclo e alinhadas com o princípio MEM de "comunidade de aprendizagem sem exclusão":

1. **Sem leaderboard global** por defeito — apenas visível se o professor ativar.
2. **Melhoria pessoal primeiro**: o ecrã de perfil destaca crescimento, não posição.
3. **Esforço inteligente recompensado**: tentativa + revisão > vitória fácil.
4. **Proteção de streak**: falhar 1 dia não quebra a streak (usa "escudo" automático, 1 por semana).
5. **Achievements ocultos**: só para surpresas divertidas, nunca para conteúdo crítico.
6. **Nunca retirar**: XP, achievements e cartões são permanentes.
7. **Linguagem positiva**: "Ainda não desbloqueaste" em vez de "Falhaste".

## 8) Integração com AIResponse v1

O sistema de gamificação consome sinais do motor de IA:

| Sinal AIResponse | Uso na gamificação |
|-----------------|-------------------|
| `topMoves[0..2]` | Detetar se jogada do aluno merece `top3_move` |
| `criticalThreats` | Gatilho para cartões de padrão tático |
| `explain.summary` | Texto de desbloqueio de cartão |
| `pedagogy.errorCode` | Identificar se erro foi corrigido (achievement `after_hint_recovery`) |
| `pedagogy.turningPointScore` | Selecionar momentos para cartão "Visto" em revisão |
| `stats.depth/simulations` | Confirmar nível de dificuldade real para barra de Mestria |

### Extensões recomendadas para gamificação

```typescript
interface GamificationEvent {
  type: 'xp' | 'achievement' | 'card_transition' | 'mission_progress' | 'level_up';
  playerId: string;
  gameId?: string;
  details: {
    xpAmount?: number;
    achievementId?: string;
    cardId?: string;
    cardNewState?: 'seen' | 'used_with_help' | 'used_alone' | 'mastered';
    missionId?: string;
    progressDelta?: number;
    aeCompetency?: string[];  // competências AE mobilizadas
  };
  timestamp: string;
}
```

## 9) Visualização recomendada

### 9.1 Durante a partida
- Barra de XP discreta no topo (não distrair do tabuleiro).
- Popup curto (2-3 seg) ao desbloquear achievement — com som suave opcional.
- Missão ativa visível num canto, mas recolhível.

### 9.2 Ecrã de perfil
- Título e nível global.
- 3 barras por jogo (Regras / Estratégia / Mestria).
- Coleção de achievements (com progresso para os não-desbloqueados).
- Galeria de cartões de padrão por jogo (estados visuais distintos).
- Histórico de missões cumpridas.

### 9.3 Painel do professor
- Vista de turma: progresso agregado por barra e por jogo.
- Alunos com frustrationSignal elevado (alerta suave).
- Missões de aula: progresso coletivo.
- Exportação simples para registo de avaliação formativa.

## 10) Faseamento de implementação

### Fase 1 — MVP (com jogo piloto)
- XP básico (partida, vitória, revisão).
- 4 achievements de onboarding + 5 transversais.
- 5 missões diárias simples.
- Perfil local (localStorage).
- Título global.

### Fase 2 — Cartões e progressão por jogo
- Cartões de padrão para jogo piloto (5-6 cartões).
- 3 barras de progressão por jogo.
- Achievements por jogo (2-3 por jogo).
- Missões semanais.

### Fase 3 — Turma e expansão
- Missões de aula.
- Painel do professor.
- Cartões para todos os jogos.
- Streaks com proteção.
- Coleções completas.

## 11) Critérios de sucesso pedagógico

O sistema é eficaz se:

| Métrica | Alvo | Como medir |
|---------|------|-----------|
| Revisões completas / partida | >= 70% | Eventos de gamificação |
| Puzzles resolvidos / semana / aluno | >= 4 | Contador local |
| Taxa de abandono após derrota | <= 20% | Sessões terminadas vs abandonadas |
| Cartões em estado "usado sozinho" ou superior | >= 40% dos desbloqueados | Progresso de cartões |
| Melhoria de challengeIndex em 10 sessões | Tendência positiva | DDA logs |
| Satisfação do aluno | >= 4/5 | Questionário periódico |

## 12) Resumo: como a gamificação serve a pedagogia

```
┌─────────────────────────────────────────────────────────┐
│  COMPETÊNCIAS AE                                         │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Resolução│ │ Raciocínio   │ │ Comunicação          │ │
│  │ Problemas│ │ Matemático   │ │ Matemática           │ │
│  └────┬─────┘ └──────┬───────┘ └──────────┬───────────┘ │
│       │              │                     │             │
│  ┌────▼─────┐ ┌──────▼───────┐ ┌──────────▼───────────┐ │
│  │Partidas  │ │Puzzles +     │ │Revisão pós-jogo      │ │
│  │+Missões  │ │Cartões       │ │+Achievements         │ │
│  │          │ │padrão        │ │metacognitivos        │ │
│  └────┬─────┘ └──────┬───────┘ └──────────┬───────────┘ │
│       │              │                     │             │
│       └──────────────┼─────────────────────┘             │
│                      ▼                                   │
│              ┌───────────────┐                           │
│              │ XP + Barras   │                           │
│              │ (visibilidade │                           │
│              │  do progresso)│                           │
│              └───────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

A gamificação não é uma camada separada: é a **interface visível** entre a atividade do aluno e as competências que está a desenvolver.
