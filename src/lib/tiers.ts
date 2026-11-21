// Rarity tiers, shortest mountain to tallest.
// Each answer's tier is fixed per question before anyone plays
// (pipeline/data/<pack>_tiers.json) and stored with its points on the answer.
// Keep names and points in sync with pipeline/tiers.py.
export type Tier = {
  name: string;
  points: number;
  /** what kind of answer lands here */
  blurb: string;
  /** summit height in metres, used for the elevation ladder */
  elevation: number;
  emoji: string;
};

export const TIERS: readonly Tier[] = [
  { name: "Everest", points: 100, blurb: "Correct, but nobody expects it here", elevation: 8849, emoji: "🟪" },
  { name: "Aconcagua", points: 85, blurb: "Deep cuts: the long tail", elevation: 6961, emoji: "🟦" },
  { name: "Kilimanjaro", points: 70, blurb: "Known, but rarely said first", elevation: 5895, emoji: "🟩" },
  { name: "Mont Blanc", points: 55, blurb: "Familiar, a step past obvious", elevation: 4806, emoji: "🟨" },
  { name: "Fuji", points: 40, blurb: "Close to obvious", elevation: 3776, emoji: "🟧" },
  { name: "Wycheproof", points: 20, blurb: "What everyone says first", elevation: 148, emoji: "🟫" },
] as const;

export const WRONG_EMOJI = "⬛";
export const MAX_POINTS = TIERS[0].points;

export function tierByName(name: string | null | undefined): Tier | null {
  return TIERS.find((t) => t.name === name) ?? null;
}
