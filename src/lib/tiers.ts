// Rarity tiers, shortest mountain to tallest.
// An answer's share (computed in the database by answer_share(), blended with a
// popularity prior) decides its tier. `maxShare` is the tier's upper bound (exclusive).
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

export const WRONG_EMOJI = "⬛";
export const MAX_POINTS = TIERS[0].points;

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

export function formatShare(share: number): string {
  if (share < 0.01) return "under 1%";
  return `${Math.round(share * 100)}%`;
}
