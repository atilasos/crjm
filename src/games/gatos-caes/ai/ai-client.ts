/**
 * AI Client for Gatos & Cães
 *
 * Provides a simple interface to the AI engine, handling worker communication.
 */

import type { GatosCaesState, Posicao } from '../types';
import type { WorkerRequest, WorkerResponse, SearchStats } from './types';

// Fallback: run engine directly if worker fails
import { computeBestMove as computeBestMoveDirect } from './engine';

let worker: Worker | null = null;
let workerReady = false;
let requestId = 0;
let pendingResolve: ((result: { move: Posicao | null; stats: SearchStats }) => void) | null = null;

/**
 * Initialize the AI worker
 */
export function initAI(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Try to create worker
      worker = new Worker(
        new URL('./gatos-caes.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event) => {
        const data = event.data;

        if (data.type === 'ready') {
          workerReady = true;
          resolve();
          return;
        }

        if (data.type === 'move_result' && pendingResolve) {
          const response = data as WorkerResponse;
          pendingResolve({ move: response.move, stats: response.stats });
          pendingResolve = null;
        }
      };

      worker.onerror = (error) => {
        console.error('AI worker error:', error);
        worker = null;
        workerReady = false;
        resolve(); // Still resolve, will fall back to sync
      };

      // Timeout for worker initialization
      setTimeout(() => {
        if (!workerReady) {
          console.warn('AI worker timeout, using fallback');
          resolve();
        }
      }, 3000);
    } catch (error) {
      console.warn('Failed to create AI worker, using fallback:', error);
      resolve();
    }
  });
}

/**
 * Compute best move using AI
 */
export async function computeMove(
  state: GatosCaesState,
  difficulty: number = 3
): Promise<{ move: Posicao | null; stats: SearchStats }> {
  // Use worker if available
  if (worker && workerReady) {
    return new Promise((resolve) => {
      pendingResolve = resolve;
      const id = ++requestId;

      const request: WorkerRequest = {
        type: 'compute_move',
        state,
        difficulty,
        requestId: id,
      };

      worker!.postMessage(request);

      // Timeout fallback
      setTimeout(() => {
        if (pendingResolve === resolve) {
          console.warn('Worker timeout, using fallback');
          pendingResolve = null;
          const result = computeBestMoveDirect(state, difficulty);
          resolve(result);
        }
      }, 30000); // 30 second timeout
    });
  }

  // Fallback: run synchronously
  return computeBestMoveDirect(state, difficulty);
}

/**
 * Cancel ongoing computation
 */
export function cancelComputation(): void {
  if (worker && workerReady) {
    worker.postMessage({ type: 'cancel' });
  }
  pendingResolve = null;
}

/**
 * Terminate the AI worker
 */
export function terminateAI(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
  }
}

/**
 * Check if AI is ready
 */
export function isAIReady(): boolean {
  return workerReady || true; // Always ready with fallback
}
