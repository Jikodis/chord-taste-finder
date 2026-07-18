export const INITIAL_ELO = 1500
export const DEFAULT_K = 32

/** Standard Elo expected score for a vs b. */
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}

/** Returns updated [ra, rb] after a comparison. */
export function eloUpdate(ra: number, rb: number, aWon: boolean, k = DEFAULT_K): [number, number] {
  const ea = expectedScore(ra, rb)
  const sa = aWon ? 1 : 0
  const delta = k * (sa - ea)
  return [ra + delta, rb - delta]
}
