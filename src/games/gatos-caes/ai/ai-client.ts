/**
 * AI Client for Gatos & Cães
 *
 * Provides a simple interface to the AI engine.
 * Uses direct/inline computation (no Web Worker) for better compatibility
 * across different bundlers and environments.
 */

import type { GatosCaesState, Posicao } from '../types';
import type { SearchStats } from './types';
import { computeBestMove } from './engine';

let isReady = false;

/**
 * Initialize the AI (no-op, always ready)
 */
export function initAI(): Promise<void> {
  return new Promise((resolve) => {
    isReady = true;
    resolve();
  });
}

/**
 * Compute best move using AI
 */
export async function computeMove(
  state: GatosCaesState,
  difficulty: number = 3
): Promise<{ move: Posicao | null; stats: SearchStats }> {
  // Small yield to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  // Run computation directly
  return computeBestMove(state, difficulty);
}

/**
 * Cancel ongoing computation (no-op for inline computation)
 */
export function cancelComputation(): void {
  // No-op - inline computation can't be cancelled
}

/**
 * Terminate the AI (no-op)
 */
export function terminateAI(): void {
  isReady = false;
}

/**
 * Check if AI is ready
 */
export function isAIReady(): boolean {
  return isReady;
}
