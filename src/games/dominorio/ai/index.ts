/**
 * Dominório AI Module
 * 
 * Exports the AI client and types for use in the game UI.
 */

export { DominorioAIClient, getDominorioAIClient, resetDominorioAIClient } from './ai-client';
export type { AIClientOptions } from './ai-client';
export {
  DominorioV1Adapter,
  computeDominorioV1,
  mapLevelToLegacyDifficulty,
} from './v1-adapter';
export type { DominorioV1AdapterOptions } from './v1-adapter';

export type { 
  AIDifficulty, 
  AIMetrics, 
  AIRequest, 
  AIResponse,
  DifficultyParams,
} from './types';

export { DIFFICULTY_PRESETS, INITIAL_METRICS } from './types';

