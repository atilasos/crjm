import type { GameId } from './types';

export type AchievementCategory =
  | 'onboarding'
  | 'aprendizagem'
  | 'consistencia'
  | 'por-jogo';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  xp: number;
  gameId?: GameId;
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly';
  targetLabel: string;
  rewardXp: number;
  gameId?: GameId;
}

export const STARTER_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_game',
    title: 'Primeiro Jogo',
    description: 'Completa a tua primeira partida.',
    category: 'onboarding',
    xp: 10,
  },
  {
    id: 'first_win',
    title: 'Primeira Vitória',
    description: 'Ganha a tua primeira partida contra o desafio proposto.',
    category: 'onboarding',
    xp: 12,
  },
  {
    id: 'first_review',
    title: 'Primeira Revisão',
    description: 'Termina uma revisão pós-jogo completa.',
    category: 'aprendizagem',
    xp: 15,
  },
  {
    id: 'review_streak_3',
    title: 'Refletor',
    description: 'Faz 3 revisões completas em sequência.',
    category: 'consistencia',
    xp: 20,
  },
  {
    id: 'atari_hunter',
    title: 'Caçador de Liberdades',
    description: 'Reconhece e executa uma captura imediata em Atari Go.',
    category: 'por-jogo',
    xp: 12,
    gameId: 'atari-go',
  },
  {
    id: 'balanced_builder',
    title: 'Equilíbrio Perfeito',
    description: 'Fecha uma partida de Produto com dois grupos fortes e equilibrados.',
    category: 'por-jogo',
    xp: 12,
    gameId: 'produto',
  },
  {
    id: 'bridge_builder',
    title: 'Construtor de Pontes',
    description: 'Cria uma ligação decisiva em Nex sem ajuda forte.',
    category: 'por-jogo',
    xp: 12,
    gameId: 'nex',
  },
];

export const STARTER_MISSIONS: MissionDefinition[] = [
  {
    id: 'daily-play-2',
    title: 'Joga 2 partidas',
    description: 'Mantém o ritmo de treino com duas partidas completas.',
    frequency: 'daily',
    targetLabel: '2 partidas',
    rewardXp: 6,
  },
  {
    id: 'daily-review-1',
    title: 'Faz 1 revisão',
    description: 'Consolida um erro ou padrão logo após jogar.',
    frequency: 'daily',
    targetLabel: '1 revisão',
    rewardXp: 8,
  },
  {
    id: 'weekly-three-games',
    title: 'Treina 3 jogos diferentes',
    description: 'Mostra transferência de estratégia entre jogos.',
    frequency: 'weekly',
    targetLabel: '3 jogos',
    rewardXp: 18,
  },
  {
    id: 'weekly-product-sabotage',
    title: 'Sabotagem elegante',
    description: 'Em Produto, corta o produto adversário numa sessão da semana.',
    frequency: 'weekly',
    targetLabel: '1 partida de Produto',
    rewardXp: 12,
    gameId: 'produto',
  },
];
