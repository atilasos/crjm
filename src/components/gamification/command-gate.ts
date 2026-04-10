export interface CommandGate {
  setBootstrap(task: Promise<unknown>): void;
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createCommandGate(): CommandGate {
  let bootstrap = Promise.resolve();
  let tail = Promise.resolve();

  return {
    setBootstrap(task: Promise<unknown>) {
      bootstrap = task.then(() => undefined, () => undefined);
    },
    run<T>(task: () => Promise<T>): Promise<T> {
      const scheduled = tail.then(() => bootstrap).then(task);
      tail = scheduled.then(() => undefined, () => undefined);
      return scheduled;
    },
  };
}
