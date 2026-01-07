/**
 * Web Worker for Gatos & Cães AI
 *
 * Runs search in a separate thread to avoid blocking the UI.
 */

import { computeBestMove, cancelSearch } from './engine';
import type { WorkerMessage, WorkerResponse } from './types';
import type { GatosCaesState } from '../types';

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    cancelSearch();
    return;
  }

  if (message.type === 'compute_move') {
    const { state, difficulty, requestId } = message;

    try {
      const { move, stats } = computeBestMove(state, difficulty);

      const response: WorkerResponse = {
        type: 'move_result',
        move,
        stats,
        requestId,
      };

      self.postMessage(response);
    } catch (error) {
      console.error('AI worker error:', error);

      // Return null move on error
      const response: WorkerResponse = {
        type: 'move_result',
        move: null,
        stats: {
          nodes: 0,
          ttHits: 0,
          ttProbes: 0,
          cutoffs: 0,
          depth: 0,
          score: 0,
          bestMove: null,
          timeMs: 0,
          nodesPerSecond: 0,
        },
        requestId,
      };

      self.postMessage(response);
    }
  }
};

// Signal ready
self.postMessage({ type: 'ready' });
