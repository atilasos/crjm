export class TimeoutError extends Error {
  override name = 'TimeoutError';

  constructor(message = 'Timeout') {
    super(message);
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout?: () => void
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout?.();
      } finally {
        clearTimeout(timer);
        reject(new TimeoutError(`Timeout after ${ms}ms`));
      }
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

