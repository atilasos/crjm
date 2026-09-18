import type { AIWorkerRequestMessage, AIWorkerResponseMessage } from '../../../ai-core/types';
import type { FaiscaState, Jogada } from '../types';
import { computeFaisca } from './engine';

self.onmessage = (event: MessageEvent<AIWorkerRequestMessage<FaiscaState, Jogada>>) => {
  if (event.data.type !== 'compute') return;
  const request = event.data.payload;
  let response: AIWorkerResponseMessage<Jogada>;
  try {
    response = { type: 'result', payload: computeFaisca(request) };
  } catch {
    response = { type: 'error', requestId: request.requestId, message: 'Faísca search failed', recoverable: true };
  }
  self.postMessage(response);
};
