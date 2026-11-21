import { TIERS } from "@/lib/tiers";

const MAX = TIERS[0].elevation;

/** The six tiers drawn to their real summit heights, each in its own colour. */
export function ElevationLadder() {
  return (
    <figure>
      <ol className="space-y-3">
        {TIERS.map((t) => (
          <li key={t.name} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3">
            <span className="leading-tight">
              <span className="block font-sign text-lg font-semibold" style={{ color: t.color }}>
                {t.name}
              </span>
              <span className="block text-sm text-haze">{t.blurb}</span>
            </span>
            <span className="h-3 rounded-full bg-rule/60" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max((t.elevation / MAX) * 100, 2)}%`, background: t.color }}
              />
            </span>
            <span className="text-right font-sign text-xl font-bold tabular-nums" style={{ color: t.color }}>
              {t.points}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-sm text-haze">
        Bars are drawn to each summit&apos;s height, from Everest (8,849 m) down to Mount Wycheproof (148 m).
        Tiers are set for each question before the day starts, so your points never change after you answer.
      </figcaption>
    </figure>
  );
}
