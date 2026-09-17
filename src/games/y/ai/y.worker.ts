import type { AIWorkerRequestMessage, AIWorkerResponseMessage } from '../../../ai-core/types';
import type { YState, YMove } from '../types';
import { computeY } from './engine';

self.onmessage = (event: MessageEvent<AIWorkerRequestMessage<YState, YMove>>) => {
  if (event.data.type !== 'compute') return;
  const request = event.data.payload;
  let response: AIWorkerResponseMessage<YMove>;
  try {
    response = { type: 'result', payload: computeY(request) };
  } catch {
    response = { type: 'error', requestId: request.requestId, message: 'Y search failed', recoverable: true };
  }
  self.postMessage(response);
};
