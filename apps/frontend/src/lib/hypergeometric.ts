// Pure, dependency-free hypergeometric math for the opening-hand
// probability row. Isolated deliberately: nothing else in the app imports
// from here, so this whole feature can be deleted by removing this file,
// hand-categories.ts, and HandProbabilityRow.tsx.

function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  const kk = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

// P(X = k): drawing n cards from a deck of N with K "successes" in it,
// exactly k of the n drawn are successes.
export function hypergeometricExact(N: number, K: number, n: number, k: number): number {
  if (N <= 0 || n <= 0 || k < 0 || k > n || k > K || n - k > N - K) return 0
  return (combination(K, k) * combination(N - K, n - k)) / combination(N, n)
}

// P(X >= k): sum of the exact-k formula over every k from `atLeast` up to
// the largest number of successes that could possibly be drawn.
export function hypergeometricAtLeast(N: number, K: number, n: number, atLeast: number): number {
  if (N <= 0 || n <= 0 || K <= 0) return 0
  const upper = Math.min(K, n)
  let sum = 0
  for (let j = Math.max(atLeast, 0); j <= upper; j++) {
    sum += hypergeometricExact(N, K, n, j)
  }
  return sum
}

// P(X=0), P(X=1), ..., P(X=capAt-1), P(X>=capAt) — the "0/1/2/3+" style
// breakdown shown when a category chip is expanded.
export function hypergeometricBuckets(N: number, K: number, n: number, capAt = 3): number[] {
  const buckets: number[] = []
  for (let j = 0; j < capAt; j++) buckets.push(hypergeometricExact(N, K, n, j))
  buckets.push(hypergeometricAtLeast(N, K, n, capAt))
  return buckets
}
