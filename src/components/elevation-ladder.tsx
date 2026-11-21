import { TIERS, shareLabel } from "@/lib/tiers";

const MAX = TIERS[0].elevation;

/** The six tiers drawn to their real summit heights. */
export function ElevationLadder() {
  return (
    <figure>
      <ol className="space-y-2.5">
        {TIERS.map((t, i) => (
          <li key={t.name} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3">
            <span className="font-sign text-lg font-semibold leading-tight">{t.name}</span>
            <span className="relative h-7">
              <span
                className="absolute inset-y-0 left-0 rounded-r-sm bg-glacier"
                style={{ width: `${Math.max((t.elevation / MAX) * 100, 1.2)}%`, opacity: 0.35 + 0.65 * (t.points / 100) }}
              />
              <span className={`absolute inset-y-0 left-2 flex items-center text-sm ${t.points >= 70 ? "font-medium text-snow" : "text-slate"}`}>
                {shareLabel(i)}
              </span>
            </span>
            <span className="text-right font-sign text-lg font-semibold tabular-nums">{t.points}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 text-sm text-stone">
        Bars are drawn to each summit&apos;s height, from Everest (8,849 m) down to Mount Wycheproof (148 m).
        Percentages are the share of players who gave the same correct answer.
      </figcaption>
    </figure>
  );
}
