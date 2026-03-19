# UI Blueprint (CRJM)

Data: 2026-03-18 (rev. 2026-03-18 — revisão UX infantil + gamificação)
Papel: Especialista UI/UX

---

## 1) Objetivo

Definir a blueprint de UI para o modo tutor e sistema de gamificação do CRJM:
- Reutilizável entre os 6 jogos via adaptadores de dados
- Desenhada para crianças de 6-12 anos em contexto escolar
- Alinhada com o contrato `AIResponse v1`
- Integrada com o sistema de gamificação (XP, achievements, cartões, missões)

---

## 2) Princípios de UX para crianças (6-12 anos)

### 2.1 Carga cognitiva mínima
- **1 informação por vez**: nunca mais de 1 insight + 1 ação sugerida em simultâneo.
- **Texto curto**: máximo 2 frases por bloco de texto. Vocabulário concreto, frases na afirmativa.
- **Hierarquia visual clara**: o tabuleiro ocupa ≥60% do ecrã; elementos secundários são periféricos.
- **Revelação progressiva**: funcionalidades avançadas escondidas atrás de gestos intencionais (tap, expand).

### 2.2 Linguagem e tom
- Tratar por "tu" — tom encorajador, nunca punitivo.
- Substituir termos abstratos: "heurística" → "pista", "variação" → "sequência de jogadas".
- Feedback positivo primeiro, sugestão de melhoria depois.
- Exemplos de micro-copy:
  - ✅ "Boa! Protegeste o teu grupo."
  - ✅ "Olha esta zona — o adversário pode atacar aqui."
  - ❌ "Jogada subóptima com delta negativo."

### 2.3 Interação tátil e motora
- **Alvos de toque ≥ 48×48 px** (WCAG 2.5.8 + recomendação infantil).
- Drag-and-drop com tolerância generosa (snap radius ≥ 16 px).
- Confirmação de jogada com botão explícito (evitar erros por toque acidental).
- Gestos simples: tap, swipe horizontal (timeline). Sem pinch-zoom obrigatório.

### 2.4 Acessibilidade e inclusão
- Contraste mínimo WCAG AA (4.5:1 texto, 3:1 elementos gráficos).
- Não depender apenas de cor para transmitir informação — usar ícones + texto.
- Suporte completo a navegação por teclado.
- Tipografia: corpo ≥ 16 px, títulos ≥ 20 px, font-weight ≥ 500 para texto principal.
- Animações respeitam `prefers-reduced-motion`.

### 2.5 Feedback sensorial
- Micro-animações de reforço: confetti leve em vitória, pulso suave em achievement.
- Sons opcionais (desligados por defeito) — beep curto em jogada, fanfarra em conquista.
- Haptic feedback em dispositivos compatíveis (vibração curta em jogada confirmada).

### 2.6 Contexto escolar
- Layout funcional em tablet 10" (resolução mínima 1024×768).
- Modo paisagem preferencial; modo retrato suportado com layout adaptado.
- Sessão curta: UI otimizada para ciclos de 10-15 minutos.
- Sem necessidade de login para jogar — perfil local via `localStorage`.

---

## 3) Decisões de produto UI

- O modo tutor mostra poucas informações por vez: `1 insight principal` + `1 ação sugerida`.
- Explicações da IA em linguagem concreta e vocabulário escolar.
- Visualizações avançadas (ameaças, zonas críticas, variações) são progressivas: simples em N1/N2, expandem em N3+.
- Revisão pós-jogo obrigatória no modo tutor, mas curta (2-4 min).
- O mesmo esqueleto de UI serve todos os jogos via adaptadores de dados.
- **Gamificação integrada mas não intrusiva**: widgets de XP/missão sempre visíveis, popups de achievement breves e não-bloqueantes.

---

## 4) Blueprint do Modo Tutor

### 4.1 Fluxo ponta-a-ponta

#### 1. Pré-jogo
- Seleção de nível (1..5) com rótulo pedagógico amigável:
  - N1: "Explorar" — N2: "Praticar" — N3: "Desafiar" — N4: "Competir" — N5: "Dominar"
- Toggle `Modo Tutor` ligado por defeito em contexto aula.
- Preview curto: "Hoje vais treinar: controlo de zona".
- **Widget de missão ativa**: mostra a missão diária atual (ex: "Joga 2 partidas — 1/2").

#### 2. Durante o jogo (In-game)
- **Tabuleiro principal** em destaque central (≥60% do viewport).
- **Painel lateral "Dica do turno"** (`TutorHintCard`):
  - Sugestão principal da IA com motivo curto.
  - Botão `Mostrar alternativa` (revela top 2-3 via `TopMovesRail`).
  - Aparece apenas quando o jogador demora >5s ou pede ajuda.
- **Camada visual no tabuleiro** (`ThreatOverlay`):
  - Ameaça crítica com borda pulsante + ícone de alerta.
  - 2-3 casas prioritárias com highlight suave.
  - Ativação: automática em N1-N2; a pedido em N3+.
- **Feedback imediato** após jogada:
  - Micro-toast (2s, fade-out): "Boa escolha!", "Jogada segura", "Atenção a esta zona".
  - Código de cor: verde (boa), azul (neutra), laranja (atenção).
- **Barra XP discreta** no header: mostra XP da sessão atual com micro-animação ao ganhar.

#### 3. Fim de jogo (Resumo rápido)
- Resultado + mensagem de progresso personalizada.
- KPI pedagógico mínimo:
  - `1 acerto estratégico` (highlight verde).
  - `1 ponto a melhorar` (sugestão construtiva).
- **Popup de XP ganho**: "+10 XP partida, +8 XP vitória" com animação de barra.
- **Popup de achievement** (se desbloqueado): breve, com ícone e título — auto-dismiss em 4s.
- CTA principal: `Rever partida` (leva à revisão pós-jogo).
- CTA secundário: `Jogar outra vez` / `Voltar ao menu`.

#### 4. Revisão pós-jogo (Turning points)
- **Timeline horizontal** com 1-3 momentos-chave.
- Para cada momento:
  - "O que jogaste" (com visualização no tabuleiro).
  - "O que a IA recomendava" (alternativa destacada).
  - "Porque importa" (1 frase curta).
- **Mini-drill** final: 1 decisão A/B/C para reforço ativo.
- **XP bónus por revisão**: "+10 XP" ao completar a revisão.
- **Desbloqueio de cartão de padrão** se o momento-chave corresponder a um padrão catalogado.

### 4.2 Componentes UI principais

| Componente | Função | Localização |
|---|---|---|
| `TutorHintCard` | Explicação curta + ação sugerida | Painel lateral |
| `ThreatOverlay` | Ameaça crítica no tabuleiro | Overlay sobre board |
| `TopMovesRail` | 2-3 jogadas candidatas (chips) | Dentro de HintCard |
| `TurningPointTimeline` | Momentos-chave pós-jogo | Ecrã de revisão |
| `ReviewDecisionCard` | Mini-exercício de consolidação | Ecrã de revisão |
| `XpToast` | Micro-notificação de XP ganho | Top-right, toast |
| `AchievementPopup` | Notificação de conquista desbloqueada | Centro, modal leve |
| `MissionWidget` | Progresso da missão ativa | Header / sidebar |
| `SessionXpBar` | Barra de XP acumulado na sessão | Header |

### 4.3 Visualizações pedagógicas

- **Ameaça crítica** (`criticalThreats`): borda de alto contraste (vermelho/laranja) + ícone + legenda textual. Nunca só cor.
- **Zonas críticas**: heatmap discreto (3 níveis de intensidade). Desativável pelo jogador.
- **Top jogadas** (`topMoves`): chips com prioridade #1/#2/#3, nunca mais de 3 itens. Cores distintas e numeradas.
- **Variação principal** (`principalVariation`): mostrada apenas ao expandir "Ver sequência" (N3+).
- **Confiança** (`confidence`): rótulo textual `Alta/Média/Baixa`, nunca percentagem crua.
- **Cartões de padrão**: quando um padrão é reconhecido, mostrar mini-cartão flutuante com nome e ícone do padrão.

### 4.4 Adaptação por faixa etária

| Aspeto | 1.º Ciclo (6-9) | 2.º-3.º Ciclo (10-12) | Secundário (13+) |
|---|---|---|---|
| Texto de dica | ≤ 1 frase, concreto | ≤ 2 frases | Até 3 frases, termos técnicos |
| Overlay de ameaça | Sempre visível | A pedido ou automático | A pedido |
| Top jogadas | Só #1 visível | #1 e #2 | Até #3 |
| Variação principal | Oculta | Oculta, expansível | Visível |
| Drill pós-jogo | A/B (2 opções) | A/B/C | A/B/C + justificação |
| Cartões de padrão | Ícone + nome | Ícone + nome + descrição | Completo |

---

## 5) Contrato AIResponse v1 (perspetiva UI)

```ts
export type TutorMode = 'competitive' | 'tutor';

export interface AIRequestV1<State, Move> {
  version: '1.0';
  requestId: string;
  gameId: 'gatos-caes' | 'dominorio' | 'quelhas' | 'produto' | 'atari-go' | 'nex';
  mode: TutorMode;
  level: 1 | 2 | 3 | 4 | 5;
  state: State;
  legalMoves?: Move[];
  timeBudgetMs?: number;
  locale?: 'pt-PT';
}

export interface AIMoveCandidate<Move> {
  move: Move;
  rank: 1 | 2 | 3;
  score?: number;
  confidence?: number; // 0..1
  reasonShort?: string; // <= 120 chars
}

export interface AICriticalThreat<ThreatMove = unknown> {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string; // ex: "Captura em 1"
  description: string; // linguagem simples
  counterMove?: ThreatMove;
  cells?: number[]; // indices para overlay
}

export interface AITurningPoint<Move> {
  ply: number;
  playedMove: Move;
  bestMove?: Move;
  swing?: number; // delta heurístico normalizado
  explanation: string;
  patternId?: string; // liga ao sistema de cartões de padrão
}

export interface AIResponseV1<Move, State = unknown> {
  version: '1.0';
  requestId: string;
  gameId: 'gatos-caes' | 'dominorio' | 'quelhas' | 'produto' | 'atari-go' | 'nex';
  mode: TutorMode;

  // decisão principal
  bestMove: Move | null;
  topMoves: AIMoveCandidate<Move>[]; // max 3
  principalVariation?: Move[];

  // explicabilidade para UI
  explainText: string; // <= 160 chars
  explainTags?: string[]; // ex: ['mobilidade', 'atari', 'paridade']
  criticalThreats?: AICriticalThreat<Move>[]; // max 2 em in-game
  confidence?: number; // 0..1

  // revisão pós-jogo
  turningPoints?: AITurningPoint<Move>[]; // max 3 no MVP

  // estado opcional para simulação/replay
  predictedState?: State;

  // observabilidade técnica
  stats: {
    elapsedMs: number;
    depth?: number;
    nodes?: number;
    simulations?: number;
    usedWasm: boolean;
    engine: 'rust-wasm' | 'ts-fallback';
  };

  warnings?: string[];
}
```

### 5.1 Regras de contrato para UI
- `bestMove`, `topMoves`, `explainText`, `stats` são obrigatórios.
- `topMoves` limitado a 3 entradas para evitar sobrecarga cognitiva.
- `criticalThreats` máximo 2 durante partida; na revisão pode ir até 3.
- `turningPoints` é opcional durante jogo e recomendado no pós-jogo.
- `patternId` em `AITurningPoint` liga ao sistema de cartões estratégicos.
- Se faltar explicabilidade (`explainText` vazio), UI cai para mensagem padrão curta e neutra.

### 5.2 Estados de falha e fallback
- Se IA falhar: UI mostra "Não consegui calcular dica agora" + mantém jogabilidade.
- Se `usedWasm=false`: não exibir como erro, apenas registar em telemetria.
- Se `bestMove=null`: UI entra em estado "sem sugestão" e só mostra ameaça/alerta quando existir.
- Se gamificação offline: widgets mostram último estado conhecido, sem bloquear jogo.

---

## 6) Integração com gamificação

A UI do modo tutor e a gamificação partilham o mesmo fluxo. A secção completa está em [`UI-GAMIFICATION.md`](./UI-GAMIFICATION.md).

### Pontos de integração no fluxo tutor:
1. **Pré-jogo**: widget de missão ativa + título do jogador visível.
2. **In-game**: barra de XP de sessão no header; feedback de XP silencioso.
3. **Fim de jogo**: popup de XP + achievement (se aplicável).
4. **Revisão pós-jogo**: XP bónus por completar revisão; desbloqueio de cartão de padrão.
5. **Perfil**: acessível a qualquer momento via avatar no header.

### Regra de não-intrusão
- Nenhum popup de gamificação interrompe a jogada em curso.
- Achievements e XP aparecem apenas em momentos de pausa natural (entre jogadas, fim de jogo).
- O jogador pode desativar notificações de gamificação sem perder progresso.

---

## 7) Layout e design system

### 7.1 Paleta de cores (Tailwind 4)
- **Primária**: azul CRJM (`--color-crjm-blue: #2563EB`) — ações, botões, links.
- **Sucesso**: verde (`--color-success: #16A34A`) — boa jogada, achievement.
- **Atenção**: laranja (`--color-warning: #F59E0B`) — ameaça, sugestão.
- **Erro**: vermelho (`--color-danger: #DC2626`) — jogada crítica, alerta.
- **Neutro**: cinza (`--color-neutral: #6B7280`) — texto secundário, bordas.
- **XP**: dourado (`--color-xp: #EAB308`) — barra de XP, ganhos.
- **Fundo**: branco/creme claro para reduzir fadiga visual em sessões escolares.

### 7.2 Tipografia
- Font stack: `Inter, system-ui, sans-serif` (boa legibilidade em ecrãs pequenos).
- Corpo: 16 px / 1.5 line-height.
- Títulos: 20-24 px / font-weight 600.
- Micro-copy (toasts, labels): 14 px / font-weight 500.

### 7.3 Breakpoints
| Nome | Min-width | Contexto |
|---|---|---|
| `sm` | 640 px | Telemóvel paisagem |
| `md` | 768 px | Tablet retrato |
| `lg` | 1024 px | Tablet paisagem (referência principal) |
| `xl` | 1280 px | Desktop |

### 7.4 Layout principal (tablet paisagem)
```
┌──────────────────────────────────────────────────────┐
│ [Avatar+Título] [Missão ativa]    [XP bar] [Nível]   │  ← Header (48px)
├──────────────────────────┬───────────────────────────┤
│                          │  Dica do Turno            │
│                          │  ┌─────────────────────┐  │
│                          │  │ TutorHintCard       │  │
│       TABULEIRO          │  │ "Protege o grupo    │  │
│       (≥60% width)       │  │  da esquerda"       │  │
│                          │  └─────────────────────┘  │
│                          │                           │
│                          │  TopMovesRail             │
│                          │  [#1] [#2] [#3]           │
│                          │                           │
│                          │  Cartão desbloqueado?     │
│                          │  ┌──────────────┐         │
│                          │  │ 🏰 Paridade  │         │
│                          │  └──────────────┘         │
├──────────────────────────┴───────────────────────────┤
│ [Feedback toast]                    [Jogada anterior] │  ← Footer (40px)
└──────────────────────────────────────────────────────┘
```

---

## 8) Plano de implementação (UI)

### Fase A — MVP (piloto Dominório)
1. Criar adaptador `AIResponse v1 → componentes UI` no jogo piloto.
2. Implementar `TutorHintCard`, `TopMovesRail`, `ThreatOverlay`.
3. Implementar revisão curta com `TurningPointTimeline` (até 3 pontos).
4. Implementar `XpToast` e `SessionXpBar` com valores hardcoded para validação.
5. Implementar `AchievementPopup` com 3-4 achievements de onboarding.

### Fase B — Generalização
1. Extrair componentes tutor para pasta comum (`src/features/tutor-ui/`).
2. Extrair componentes gamificação para `src/features/gamification/`.
3. Aplicar aos jogos com maior maturidade de engine (Atari Go e Quelhas).
4. Normalizar linguagem por faixa etária (tabela 4.4).

### Fase C — Hardening escolar
1. Melhorar acessibilidade (contraste, tamanhos, navegação teclado).
2. Otimizar mobile/tablet para contexto sala de aula.
3. Integrar perfil completo com cartões e missões.
4. Adicionar telemetria local mínima sem dados pessoais.

---

## 9) Telemetria local mínima (sem dados sensíveis)

### Eventos tutor
- `tutor_hint_shown`
- `tutor_hint_used`
- `tutor_review_started`
- `tutor_turning_point_viewed`
- `tutor_drill_completed`

### Eventos gamificação
- `xp_gained` (amount, source)
- `achievement_unlocked` (achievementId)
- `mission_progress` (missionId, progress)
- `pattern_card_unlocked` (cardId, gameId)
- `streak_updated` (streakDays)

### Campos base por evento
- `gameId`, `level`, `mode`, `elapsedMs`, `usedWasm`, `sessionId` anónimo.
- Nunca: nome, email, escola, turma, ou qualquer dado identificável.

---

## 10) Critérios de aceite UI

### Tutor
- Revisão pós-jogo concluída em < 4 minutos.
- Cada partida em modo tutor produz ≥ 1 insight acionável.
- Sem bloqueio percetível da UI durante cálculo de dicas.
- Mesma estrutura visual funcional em ≥ 2 jogos com adaptador de contrato.

### UX infantil
- Todos os alvos de toque ≥ 48×48 px.
- Texto de dica ≤ 2 frases para 1.º ciclo.
- Layout funcional em tablet 10" paisagem (1024×768).
- Contraste WCAG AA em todos os elementos interativos.

### Gamificação
- Popup de achievement auto-dismiss em ≤ 4 segundos.
- Nenhum popup interrompe jogada em curso.
- XP atualiza em tempo real sem refresh.
- Perfil acessível em ≤ 2 taps a partir de qualquer ecrã.
