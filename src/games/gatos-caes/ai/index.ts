/**
 * Gatos & Cães AI Module
 *
 * Exports the AI client interface for use in the game component.
 */

export { initAI, computeMove, cancelComputation, terminateAI, isAIReady } from './ai-client';
export type { SearchStats, AIConfig } from './types';
export { DIFFICULTY_CONFIGS } from './types';
