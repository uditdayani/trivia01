// Rarity tiers, shortest mountain to tallest.
// `maxShare` is the upper bound (exclusive) of an answer's share of correct answers.
export type Tier = {
  name: string;
  points: number;
  maxShare: number;
  emoji: string;
};

export const TIERS: readonly Tier[] = [
  { name: "Everest", points: 100, maxShare: 0.02, emoji: "🟪" },
  { name: "Aconcagua", points: 85, maxShare: 0.1, emoji: "🟦" },
  { name: "Kilimanjaro", points: 70, maxShare: 0.25, emoji: "🟩" },
  { name: "Mont Blanc", points: 55, maxShare: 0.4, emoji: "🟨" },
  { name: "Fuji", points: 40, maxShare: 0.5, emoji: "🟧" },
  { name: "Wycheproof", points: 20, maxShare: Infinity, emoji: "🟫" },
] as const;

export const WRONG = { name: "Wrong", points: 0, emoji: "⬛" } as const;

/** How many "virtual players" the seeded prior is worth (see design doc, Core logic). */
export const PRIOR_STRENGTH = 50;

/**
 * Blended share of an answer: (n_a + k * p_a) / (N + k).
 * @param n      players who gave this answer
 * @param total  all correct answers to the prompt
 * @param prior  seeded prior share for this answer (0..1)
 */
export function blendedShare(n: number, total: number, prior: number, k = PRIOR_STRENGTH): number {
  return (n + k * prior) / (total + k);
}

export function tierForShare(share: number): Tier {
  return TIERS.find((t) => share < t.maxShare) ?? TIERS[TIERS.length - 1];
}
