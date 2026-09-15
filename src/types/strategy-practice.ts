import type { GameId } from '../ai-core/types';
import type { PuzzleDiagram } from '../ai-core/puzzles';

export interface StrategyOption { id: string; label: string }
export interface StrategyChallenge {
  id: string;
  gameId: GameId;
  familyId: string;
  skill: string;
  prompt: string;
  facts: string[];
  question: string;
  options: StrategyOption[];
  prediction: string;
  predictions: StrategyOption[];
  diagram?: PuzzleDiagram;
}
export interface StrategyEvidence {
  contextId: string;
  familyId: string;
  completedAt: string;
  correct: boolean;
  assisted: boolean;
}
export interface StrategyProgress {
  stage: 'start' | 'practice' | 'independent' | 'retained';
  independent: number;
  practiced: number;
  reviewAt: string | null;
  needsPractice: boolean;
}
export interface StrategyPracticeView {
  attemptId: string;
  challenge: StrategyChallenge;
  hint: string | null;
  feedback: { correct: boolean; independent: boolean; explanation: string } | null;
  progress: StrategyProgress;
}
