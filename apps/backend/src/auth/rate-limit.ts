// Minimal in-memory fixed-window limiter for the login endpoint. Good enough
// for a single-instance MVP deployment — not distributed, resets on
// restart. Swap for a shared store (Redis, etc.) if this ever runs as more
// than one process.
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= max) return false

  bucket.count++
  return true
}

// Opportunistic cleanup so long-running processes don't accumulate one
// bucket per distinct (ip, email) forever.
setInterval(
  () => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  },
  10 * 60 * 1000,
).unref()
