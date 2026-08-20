// Runs `fn` over `items` with at most `concurrency` calls in flight at once.
// No dependency pulled in just for a worker-pool of this size.
export async function runBatched<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items]

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item === undefined) return
      await fn(item)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}
