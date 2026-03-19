# UI Gamificação — Especificação de Interface (CRJM)

Data: 2026-03-18
Papel: Especialista UI/UX
Dependências: [`UI-BLUEPRINT.md`](./UI-BLUEPRINT.md), `Gamificacao-sistema-implementacao.md`

---

## 1) Objetivo

Especificar a UI concreta do sistema de gamificação do CRJM:
- Ecrã de perfil do jogador
- Popups e notificações de achievement
- Widgets em jogo (XP, missões, cartões)
- Integração com o modo tutor
- Comportamento responsivo para tablet/escola

---

## 2) Princípios de design da gamificação

1. **Não-intrusão**: gamificação nunca interrompe a jogada em curso.
2. **Visibilidade passiva**: progresso sempre visível no header, mas discreto.
3. **Celebração breve**: popups de achievement duram ≤ 4s e são não-bloqueantes.
4. **Progressão pessoal**: UI foca melhoria individual, não comparação/ranking.
5. **Coerência com tutor**: mesma linguagem, mesmos componentes base, mesma paleta.

---

## 3) Componentes de gamificação

### 3.1 Inventário de componentes

| Componente | Tipo | Contexto |
|---|---|---|
| `PlayerBadge` | Inline | Header — avatar + título + nível |
| `SessionXpBar` | Barra | Header — XP acumulado na sessão |
| `XpToast` | Toast | Após evento — "+10 XP" |
| `XpBreakdown` | Card | Fim de jogo — detalhe de XP ganho |
| `AchievementPopup` | Modal leve | Após desbloqueio |
| `AchievementCard` | Card | Perfil — cada conquista |
| `MissionWidget` | Card compacto | Header/sidebar — missão ativa |
| `MissionList` | Lista | Perfil — missões diárias/semanais |
| `PatternCard` | Card | Perfil + in-game — cartão de padrão |
| `PatternCardUnlock` | Toast/modal | Após desbloqueio de padrão |
| `GameProgressBars` | Barras triplas | Perfil — regras/estratégia/mestria |
| `StreakIndicator` | Badge | Header — dias consecutivos |
| `ProfileScreen` | Ecrã completo | Menu principal |
| `LevelUpModal` | Modal | Ao subir de nível global |

---

## 4) Ecrã de perfil do jogador

### 4.1 Layout

```
┌──────────────────────────────────────────────────────┐
│ ← Voltar                PERFIL               [Config]│
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────┐   Nome do Jogador                         │
│   │Avatar│   Título: "Estratega"                     │
│   └──────┘   Nível 3 — 120/220 XP ████████░░░       │
│              Streak: 5 dias 🔥                       │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Conquistas]  [Cartões]  [Missões]  [Jogos]        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  (conteúdo do tab ativo)                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.2 Secção: Cabeçalho do perfil

**`PlayerProfileHeader`**

- **Avatar**: ícone genérico (sem foto). Customizável no futuro com ícones desbloqueados.
- **Nome**: `displayName` editável localmente. Sem apelido real — pseudónimo livre.
- **Título**: rótulo textual baseado no nível global:
  - N1 "Explorador" / N2 "Aprendiz" / N3 "Estratega" / N4 "Desafiador" / N5 "Campeão" / N6+ "Mestre em Formação"
- **Barra de XP global**: barra horizontal com XP atual / XP para próximo nível.
  - Cor: dourado (`--color-xp`).
  - Label: "120 / 220 XP".
  - Animação suave ao ganhar XP.
- **Streak**: número de dias + ícone de chama. Aparece só se streak ≥ 2 dias.

### 4.3 Tab: Conquistas (Achievements)

**Layout**: grid de cards 2×N (tablet) ou 1×N (telemóvel).

**`AchievementCard`**:
```
┌─────────────────────────┐
│  🏆  Primeiro Jogo      │  ← ícone + título
│  Completaste a tua      │  ← descrição (1-2 linhas)
│  primeira partida!      │
│                         │
│  +10 XP    Onboarding   │  ← pontos + categoria
│  ✓ Desbloqueado         │  ← estado
└─────────────────────────┘
```

**Estados visuais**:
- **Desbloqueado**: fundo claro, ícone a cores, checkmark verde.
- **Bloqueado**: fundo cinza, ícone em silhueta, texto "???".
- **Oculto** (`hidden: true`): não aparece na lista até ser desbloqueado.

**Filtros**: `Todas` | `Onboarding` | `Aprendizagem` | `Consistência` | `Por jogo`.

**Contador**: "12 / 28 conquistas" no topo do tab.

### 4.4 Tab: Cartões de padrões estratégicos

**Layout**: grid de cards por jogo, agrupados com cabeçalho do jogo.

**`PatternCard`**:
```
┌─────────────────────────┐
│  ♟️  Paridade            │  ← ícone do padrão + nome
│  Dominório               │  ← jogo
│                         │
│  Controlar a paridade   │  ← descrição curta
│  das casas vazias.      │
│                         │
│  ████░░░░  Usado (2/4)  │  ← barra de mestria
│  [Rever padrão]         │  ← link para explicação
└─────────────────────────┘
```

**Níveis de mestria do cartão** (barra de 4 segmentos):
1. **Visto** (1/4) — cinza claro: o padrão apareceu numa revisão.
2. **Usado com ajuda** (2/4) — azul: aplicou após hint.
3. **Usado sozinho** (3/4) — verde: reconheceu e aplicou sem ajuda.
4. **Dominado** (4/4) — dourado: consistência em múltiplos jogos.

**Agrupamento**: por jogo, com contagem "3/6 cartões" por jogo.

### 4.5 Tab: Missões

**Layout**: lista vertical com secções "Hoje" e "Esta semana".

**`MissionItem`**:
```
┌─────────────────────────────────────────┐
│  📋  Joga 2 partidas          1/2       │
│  ████████░░░░░░░░             +6 XP     │
│                               Diária    │
└─────────────────────────────────────────┘
```

**Estados**:
- **Em progresso**: barra parcial, texto normal.
- **Completa**: checkmark verde, barra cheia, XP já atribuído.
- **Expirada**: texto riscado, cinza.

**Missões de aula** (Fase 3): secção separada com indicador de progresso coletivo.

### 4.6 Tab: Jogos (progresso por jogo)

**Layout**: lista de 6 jogos com barras de progresso.

**`GameProgressCard`**:
```
┌─────────────────────────────────────────┐
│  🎲  Dominório                          │
│                                         │
│  Regras      ████████░░  4/5            │
│  Estratégia  ██████░░░░  3/5            │
│  Mestria     ████░░░░░░  2/5            │
│                                         │
│  32 partidas  |  18 vitórias  |  5 rev. │
│  Último jogo: hoje                      │
└─────────────────────────────────────────┘
```

**Barras**: 3 barras horizontais (regras/estratégia/mestria), cada uma 0-5.
- Regras: azul.
- Estratégia: verde.
- Mestria: dourado.

**Stats resumidos**: partidas, vitórias, revisões completas.

---

## 5) Popups e notificações

### 5.1 `XpToast` — Ganho de XP

**Quando aparece**: após cada evento que gera XP (fim de partida, revisão, puzzle, etc.).

**Aparência**:
```
┌──────────────────┐
│  +10 XP  ⭐      │
│  Partida completa│
└──────────────────┘
```

**Comportamento**:
- Posição: top-right, abaixo do header.
- Duração: 2 segundos, fade-out.
- Empilhável: se vários XP em sequência, empilham verticalmente com delay de 0.3s.
- Animação: slide-in da direita + escala suave.
- **Nunca bloqueia interação**.

### 5.2 `AchievementPopup` — Conquista desbloqueada

**Quando aparece**: no momento do desbloqueio (normalmente fim de jogo ou fim de revisão).

**Aparência**:
```
┌──────────────────────────────────────┐
│                                      │
│          🏆  CONQUISTA!              │
│                                      │
│       Primeira Revisão Completa      │
│     Fizeste a tua primeira revisão   │
│           pós-jogo. Parabéns!        │
│                                      │
│            +15 XP                    │
│                                      │
│          [Ver no perfil]             │
└──────────────────────────────────────┘
```

**Comportamento**:
- Modal semi-transparente com backdrop suave (não escuro).
- Auto-dismiss após 4 segundos OU tap em qualquer lugar.
- Botão "Ver no perfil" é opcional — tap no backdrop também fecha.
- Micro-animação: escala de 0.8→1.0 + confetti leve (3-5 partículas, 1s).
- Se múltiplos achievements em simultâneo: mostrar em sequência com 0.5s entre cada.
- **Nunca aparece durante uma jogada ativa** — espera pelo momento de pausa.

### 5.3 `PatternCardUnlock` — Cartão de padrão desbloqueado

**Quando aparece**: durante revisão pós-jogo, quando um turning point corresponde a um padrão.

**Aparência**:
```
┌──────────────────────────────────────┐
│  ✨ Novo padrão descoberto!          │
│                                      │
│  ┌────────────────────┐              │
│  │ ♟️ Paridade         │              │
│  │ Dominório           │              │
│  │                     │              │
│  │ Controlar o número  │              │
│  │ de casas vazias.    │              │
│  └────────────────────┘              │
│                                      │
│  [Adicionar à coleção]               │
└──────────────────────────────────────┘
```

**Comportamento**:
- Aparece inline na timeline de revisão, junto ao turning point relevante.
- Não é modal — integra-se no fluxo de revisão.
- Tap em "Adicionar à coleção" dá feedback tátil e fecha o card.
- Animação: flip horizontal do cartão (como desvendar uma carta).

### 5.4 `LevelUpModal` — Subida de nível

**Quando aparece**: quando XP acumulado atinge threshold do próximo nível.

**Aparência**:
```
┌──────────────────────────────────────┐
│                                      │
│          ⬆️  NÍVEL 3!                │
│                                      │
│       Novo título: "Estratega"       │
│                                      │
│       ████████████████ 120 XP        │
│                                      │
│          [Continuar]                 │
└──────────────────────────────────────┘
```

**Comportamento**:
- Modal com backdrop. Requer tap em "Continuar" para fechar.
- Exceção à regra de auto-dismiss — subir de nível é raro e merece pausa.
- Animação: partículas douradas + pulse no título.
- Aparece apenas no fim de jogo ou fim de revisão, nunca mid-game.

---

## 6) Widgets em jogo (in-game)

### 6.1 `PlayerBadge` (header)

**Localização**: canto superior esquerdo do header.

```
┌──────────────────┐
│ [🧑] Estratega 3 │
└──────────────────┘
```

- Avatar mini (24×24 px) + título abreviado + nível.
- Tap abre perfil completo.
- Tamanho de toque: 48×48 px mínimo.

### 6.2 `SessionXpBar` (header)

**Localização**: header, à direita do `PlayerBadge`.

```
┌─────────────────────┐
│  ⭐ 38 XP  ████░░░  │
└─────────────────────┘
```

- Mostra XP ganho na sessão atual (reset por sessão).
- Barra dourada com animação suave ao incrementar.
- Tooltip (hover/long-press): "38 XP nesta sessão. Faltam 82 para o nível 4."

### 6.3 `MissionWidget` (header/sidebar)

**Localização**: header (compacto) ou sidebar (expandido).

**Compacto (header)**:
```
┌──────────────────────┐
│  📋 Joga 2 partidas ░│
└──────────────────────┘
```
- 1 linha: ícone + título da missão mais urgente + indicador de progresso.
- Tap expande para ver todas as missões ativas.

**Expandido (sidebar, quando espaço permite)**:
```
┌──────────────────────────┐
│  Missões de hoje          │
│  ✓ Joga 2 partidas  2/2  │
│  ○ Faz 1 revisão    0/1  │
│  ○ Resolve 2 puzzles 1/2 │
└──────────────────────────┘
```

### 6.4 `StreakIndicator` (header)

**Localização**: junto ao `PlayerBadge`.

```
🔥 5
```

- Só aparece se streak ≥ 2 dias.
- Tooltip: "5 dias seguidos a treinar!"
- Animação de chama quando streak é atualizado.

### 6.5 `XpBreakdown` (fim de jogo)

**Localização**: ecrã de fim de jogo, entre resultado e CTA.

```
┌──────────────────────────────────┐
│  XP desta partida:               │
│                                  │
│  Partida completa      +10 XP   │
│  Vitória               +8 XP    │
│  Jogada top 3          +3 XP    │
│  ─────────────────────────────   │
│  Total                 +21 XP   │
│                                  │
│  ████████████░░░  141 / 220 XP  │
└──────────────────────────────────┘
```

- Lista detalhada de fontes de XP.
- Cada linha aparece sequencialmente (stagger 0.3s) para efeito de revelação.
- Barra global atualiza em tempo real ao somar.

---

## 7) Integração com o modo tutor

### 7.1 Fluxo de eventos gamificação ↔ tutor

```
Jogada do aluno
  ↓
AIResponse v1 (com topMoves, criticalThreats, turningPoints)
  ↓
Avaliação da jogada:
  ├─ Jogada está em topMoves[0..2]? → candidata a "Pensador" + XP bónus
  ├─ Jogada evita criticalThreat? → candidata a "Guardião" + XP bónus
  └─ Jogada péssima após hint? → sem penalização, apenas sem bónus
  ↓
Fim de jogo:
  ├─ XpBreakdown com todas as fontes
  ├─ Achievement check (verifica critérios de desbloqueio)
  └─ Missão progress update
  ↓
Revisão pós-jogo:
  ├─ turningPoints → possível desbloqueio de PatternCard
  ├─ Drill completado → XP bónus
  └─ Revisão completa → Achievement "Refletor" progress
```

### 7.2 Mapeamento AIResponse v1 → eventos de gamificação

| Campo AIResponse | Evento gamificação | Condição |
|---|---|---|
| `topMoves[].rank` | `top3_move` achievement progress | Jogada do aluno está em `topMoves[0..2]` |
| `criticalThreats[]` | `threat_avoided` XP bónus | Aluno jogou `counterMove` |
| `turningPoints[].patternId` | `pattern_card_unlock` | PatternId válido + contexto de revisão |
| `turningPoints[]` length | `review_complete` XP | Aluno viu todos os turning points |
| `explainTags[]` | Categorização de cartões | Tags mapeiam para famílias de padrões |
| `stats.elapsedMs` | Nenhum (telemetria) | Registado para análise |

### 7.3 Regras de não-intrusão no modo tutor

1. **Mid-game**: apenas `XpToast` (2s, top-right). Nenhum modal.
2. **Entre jogadas**: `XpToast` pode aparecer. `PatternCardUnlock` não.
3. **Fim de jogo**: `XpBreakdown` → `AchievementPopup` (se houver) → CTA.
4. **Revisão**: `PatternCardUnlock` inline. `XpToast` ao completar.
5. **Subida de nível**: apenas no fim de jogo ou revisão, modal com dismiss obrigatório.

### 7.4 Feedback positivo do tutor + gamificação combinados

Exemplo de fluxo fim de jogo em modo tutor:

```
1. Resultado: "Vitória! Boa partida." (1s)
2. KPI pedagógico: "Protegeste bem os teus grupos." (2s)
3. XpBreakdown: revelação sequencial (3s)
4. Achievement popup (se houver): "🏆 Caçador de Liberdades" (4s auto-dismiss)
5. CTA: "Rever partida" + "Jogar outra vez"
```

Tempo total do fluxo: ~10 segundos. Não bloqueante — o jogador pode skipar a qualquer momento.

---

## 8) Armazenamento local

### 8.1 Modelo de dados (`localStorage`)

```ts
interface PlayerProfile {
  playerId: string;          // UUID gerado no primeiro acesso
  displayName: string;
  title: string;
  xpTotal: number;
  levelGlobal: number;
  streakDays: number;
  lastPlayedDate: string;    // ISO date, para cálculo de streak
  achievementsUnlocked: string[];  // achievement IDs
  cardsUnlocked: Record<string, PatternCardState>;
  gameProgress: Record<string, GameProgress>;
  missionsState: MissionState[];
  settings: {
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    reducedMotion: boolean;
  };
}

interface PatternCardState {
  mastery: 0 | 1 | 2 | 3;
  timesUsed: number;
  lastSeenAt?: string;
}

interface GameProgress {
  rulesLevel: number;       // 0-5
  strategyLevel: number;    // 0-5
  masteryLevel: number;     // 0-5
  xp: number;
  gamesPlayed: number;
  wins: number;
  reviewsCompleted: number;
  puzzlesSolved: number;
  lastPlayedAt?: string;
}

interface MissionState {
  missionId: string;
  progressCurrent: number;
  completed: boolean;
  dateAssigned: string;      // ISO date
}
```

### 8.2 Chave de armazenamento
- `crjm_player_profile` — perfil completo serializado em JSON.
- Tamanho estimado: < 10 KB para jogador ativo.
- Sem dados pessoais identificáveis — `displayName` é pseudónimo livre.

### 8.3 Resiliência
- Se `localStorage` indisponível: gamificação desativada silenciosamente, jogo funciona normalmente.
- Se dados corrompidos: reset para perfil novo com mensagem "Progresso reiniciado".
- Exportar/importar perfil (Fase 3): botão no ecrã de perfil para transferir entre dispositivos.

---

## 9) Animações e micro-interações

### 9.1 Catálogo de animações

| Animação | Duração | Easing | Trigger |
|---|---|---|---|
| XP toast slide-in | 300ms | ease-out | Ganho de XP |
| XP toast fade-out | 200ms | ease-in | Após 2s |
| XP bar fill | 600ms | ease-in-out | Atualização de XP |
| Achievement scale-in | 400ms | spring(1, 80, 10) | Desbloqueio |
| Achievement confetti | 1000ms | linear | Desbloqueio |
| Level-up particles | 1500ms | ease-out | Subida de nível |
| Pattern card flip | 500ms | ease-in-out | Desbloqueio de cartão |
| Streak flame pulse | 300ms | ease-in-out | Atualização de streak |
| Progress bar fill | 400ms | ease-out | Atualização de barra |
| Mission complete check | 300ms | spring | Missão completa |

### 9.2 Regras de animação
- Todas respeitam `prefers-reduced-motion: reduce` — sem animação, transição instantânea.
- Confetti e partículas: máximo 10 partículas, sem loop.
- Nenhuma animação bloqueia interação.
- Framerate: targetar 60fps; degradar gracefully em dispositivos lentos.

---

## 10) Responsividade

### 10.1 Adaptações por breakpoint

| Elemento | `sm` (640) | `md` (768) | `lg` (1024) | `xl` (1280) |
|---|---|---|---|---|
| Header gamificação | PlayerBadge + XP só | + MissionWidget | + StreakIndicator | Completo |
| Perfil layout | 1 coluna | 1 coluna | 2 colunas | 2 colunas |
| Achievement grid | 1×N | 2×N | 2×N | 3×N |
| Pattern cards | 1×N | 2×N | 2×N | 3×N |
| XpBreakdown | Compacto | Completo | Completo | Completo |
| Sidebar tutor | Oculta (drawer) | Oculta (drawer) | Visível | Visível |

### 10.2 Tablet 10" (referência principal)
- Layout `lg` (1024×768).
- Header com todos os widgets de gamificação visíveis.
- Perfil em 2 colunas: info à esquerda, tabs à direita.
- Alvos de toque: ≥ 48×48 px sem exceção.

---

## 11) Faseamento de implementação

### Fase 1 — MVP
**Componentes**:
- `PlayerBadge` (header, estático)
- `SessionXpBar` (header)
- `XpToast` (após eventos)
- `XpBreakdown` (fim de jogo)
- `AchievementPopup` (4-5 achievements de onboarding)
- Perfil básico: nome + título + XP + lista de achievements

**Dados**: `localStorage` com `PlayerProfile` simplificado.

**Jogos**: apenas piloto (Dominório).

### Fase 2 — Expansão
**Componentes**:
- `MissionWidget` + `MissionList`
- `PatternCard` + `PatternCardUnlock`
- `GameProgressBars`
- Perfil completo com 4 tabs
- `StreakIndicator`

**Dados**: `GameProgress` por jogo, `MissionState`.

**Jogos**: Dominório + Atari Go + Quelhas.

### Fase 3 — Maturidade
**Componentes**:
- `LevelUpModal`
- Missões de aula (coletivas)
- Export/import de perfil
- Avatares desbloqueáveis
- Eventos sazonais (campeonato interno)

**Jogos**: todos os 6.

---

## 12) Critérios de aceite

### Funcionalidade
- XP atualiza corretamente após cada evento (partida, revisão, puzzle).
- Achievements desbloqueiam quando critérios são cumpridos.
- Perfil reflete estado atual sem necessidade de refresh.
- Missões progridem e completam corretamente.
- Cartões de padrão desbloqueiam durante revisão pós-jogo.

### UX
- Nenhum popup interrompe jogada em curso.
- Achievement popup auto-dismiss em ≤ 4s.
- XpToast desaparece em ≤ 2s.
- Perfil acessível em ≤ 2 taps de qualquer ecrã.
- Todas as animações respeitam `prefers-reduced-motion`.
- Layout funcional em tablet 10" paisagem (1024×768).

### Performance
- Leitura de perfil de `localStorage`: < 5ms.
- Escrita de perfil: < 10ms.
- Nenhum cálculo de gamificação bloqueia a thread principal > 16ms.
- Componentes de gamificação adicionam < 15 KB ao bundle (gzipped).

### Acessibilidade
- Todos os popups anunciados via `aria-live="polite"`.
- Barras de progresso com `role="progressbar"` + `aria-valuenow`.
- Achievement cards navegáveis por teclado.
- Contraste WCAG AA em todos os elementos.
