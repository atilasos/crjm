import type { AIRequestV1, AIResponseV1, AIWorkerResponseMessage } from '../../../ai-core/types';
import type { YState, YMove } from '../types';

/** Each request owns its worker. Aborting terminates the running search, not
 * just a queued cancel message that a synchronous search cannot process. */
export function requestYMove(request: AIRequestV1<YState, YMove>, signal: AbortSignal): Promise<AIResponseV1<YMove>> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const worker = new Worker(new URL('./ai/y/y.worker.js', document.baseURI), { type: 'module' });
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate(); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const abort = () => fail(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Y worker timeout')), 5000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => fail(new Error('Y worker unavailable'));
    worker.onmessage = (event: MessageEvent<AIWorkerResponseMessage<YMove>>) => {
      const message = event.data;
      if (message.type === 'error' && message.requestId === request.requestId) fail(new Error(message.message));
      if (message.type === 'result' && message.payload.requestId === request.requestId) {
        cleanup(); resolve(message.payload);
      }
    };
    try { worker.postMessage({ type: 'compute', payload: request }); }
    catch (error) { fail(error instanceof Error ? error : new Error('Y worker unavailable')); }
  });
}
