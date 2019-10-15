export class AsyncMutex {
  private lastToRun: Promise<unknown> | undefined;

  // Run an async function with a lock on this mutex.
  // Waits until the mutex is available, locks it, runs the function, then releases it.
  async with<T>(fn: () => Promise<T>): Promise<T> {
    const p = (async () => {
      // If the mutex is locked, wait for the last thing in the queue before running.
      // (Everything in the queue runs in order, so this is after everything currently enqueued.)
      if (this.lastToRun) {
        await this.lastToRun;
      }
      return fn();
    })();

    // Push the newly-created Promise onto the queue.
    this.lastToRun = p;
    // And return so the caller can wait on the result.
    return p;
  }
}
