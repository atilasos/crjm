# F7 — Dicas visuais/contextuais + plano de gamification

## Objetivo
Tornar as dicas mais imediatas para o aluno, reduzindo dependência de texto abstrato, e preparar uma camada de gamification alinhada com progresso pedagógico.

## Slice implementado nesta vaga
1. **Consolidação visual/contextual do tutor**
   - highlights visuais no tabuleiro para a jogada recomendada;
   - respostas críticas com destaque separado;
   - barra contextual comum com sinais de confiança/engine/tática;
   - legenda visual comum entre jogos.
2. **Fundação de gamification**
   - catálogo typed de achievements/missões iniciais em `src/ai-core/gamification.ts`.

## Roadmap de implementação de gamification

### Fase G1 — Progresso local
- persistência local (`localStorage`) de:
  - XP total
  - streak diário
  - achievements desbloqueados
  - progresso por jogo (regras / estratégia / mestria)

### Fase G2 — UI mínima
- `PlayerBadge`
- `SessionXpBar`
- `MissionWidget`
- `AchievementPopup`
- `GameProgressBars`

### Fase G3 — Integração com tutor/revisão
- XP por:
  - completar partida
  - revisão pós-jogo
  - resolver puzzle
  - seguir melhor jogada sem hint forte
- desbloqueio de padrões/cartões em turning points

### Fase G4 — Modo turma/professor
- missões coletivas
- progresso agregado por turma
- vista de acompanhamento sem leaderboard competitivo global

## Regras de produto
- Aprendizagem > vitória
- Revisão vale mais que ganhar
- Progressão é pessoal e nunca punitiva
- Gamification nunca interrompe jogada ativa

## Critérios de aceitação futuros
- progresso persiste entre sessões;
- achievements aparecem sem bloquear a jogada;
- tutor/review alimentam desbloqueios reais;
- sem leaderboard global por defeito.
