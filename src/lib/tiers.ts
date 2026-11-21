// Rarity tiers, shortest mountain to tallest.
// `maxShare` is the upper bound (exclusive) of an answer's share of correct answers.
export type Tier = {
  name: string;
  points: number;
  maxShare: number;
  /** summit height in metres, used for the elevation ladder */
  elevation: number;
  emoji: string;
};

export const TIERS: readonly Tier[] = [
  { name: "Everest", points: 100, maxShare: 0.02, elevation: 8849, emoji: "🟪" },
  { name: "Aconcagua", points: 85, maxShare: 0.1, elevation: 6961, emoji: "🟦" },
  { name: "Kilimanjaro", points: 70, maxShare: 0.25, elevation: 5895, emoji: "🟩" },
  { name: "Mont Blanc", points: 55, maxShare: 0.4, elevation: 4806, emoji: "🟨" },
  { name: "Fuji", points: 40, maxShare: 0.5, elevation: 3776, emoji: "🟧" },
  { name: "Wycheproof", points: 20, maxShare: Infinity, elevation: 148, emoji: "🟫" },
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

/** Human label for the share band a tier covers, e.g. "2–10%". */
export function shareLabel(i: number): string {
  const pct = (x: number) => Math.round(x * 100);
  const hi = TIERS[i].maxShare;
  const lo = i === 0 ? 0 : TIERS[i - 1].maxShare;
  if (lo === 0) return `under ${pct(hi)}%`;
  if (!Number.isFinite(hi)) return `over ${pct(lo)}%`;
  return `${pct(lo)}–${pct(hi)}%`;
}
