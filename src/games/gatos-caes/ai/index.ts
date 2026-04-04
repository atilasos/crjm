/**
 * Gatos & Cães AI Module
 *
 * Exports the AI client interface for use in the game component.
 */

export { initAI, computeMove, cancelComputation, terminateAI, isAIReady } from './ai-client';
export type { AIComputeOverrides } from './ai-client';
export type { SearchStats, AIConfig } from './types';
export { DIFFICULTY_CONFIGS } from './types';
export { GatosCaesV1Adapter, mapLevelToDifficulty } from './v1-adapter';
export { buildQuickReviewItems, resolveHintLevel } from './pedagogy-mvp';
