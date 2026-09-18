import type { AIRequestV1, AIResponseV1, AIWorkerResponseMessage } from '../../../ai-core/types';
import type { FaiscaState, Jogada } from '../types';

/** Each request owns its worker. Aborting terminates the running search, not
 * just a queued cancel message that a synchronous search cannot process. */
export function requestFaiscaMove(request: AIRequestV1<FaiscaState, Jogada>, signal: AbortSignal): Promise<AIResponseV1<Jogada>> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const worker = new Worker(new URL('./ai/faisca/faisca.worker.js', document.baseURI), { type: 'module' });
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate(); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const abort = () => fail(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Faísca worker timeout')), 5000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => fail(new Error('Faísca worker unavailable'));
    worker.onmessage = (event: MessageEvent<AIWorkerResponseMessage<Jogada>>) => {
      const message = event.data;
      if (message.type === 'error' && message.requestId === request.requestId) fail(new Error(message.message));
      if (message.type === 'result' && message.payload.requestId === request.requestId) {
        cleanup(); resolve(message.payload);
      }
    };
    try { worker.postMessage({ type: 'compute', payload: request }); }
    catch (error) { fail(error instanceof Error ? error : new Error('Faísca worker unavailable')); }
  });
}
