// The question clock as a field compass: one bezel tick per second, the
// needle sweeping round as time goes, the seconds left in the middle.
// Clouds roll in over the page as the clock runs down; they sit behind the
// question and the answer box, which stay readable over them.

const SIZE = 100;
const C = SIZE / 2;

export function CompassTimer({
  seconds,
  total,
  fraction,
  active,
}: {
  seconds: number;
  total: number;
  /** 1 = full time, 0 = none */
  fraction: number;
  active: boolean;
}) {
  const low = active && fraction < 0.25;
  const lit = Math.ceil(fraction * total);
  const angle = (1 - fraction) * 360;
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-16 w-16 shrink-0 sm:h-[4.5rem] sm:w-[4.5rem]"
      aria-hidden="true"
    >
      <circle
        cx={C}
        cy={C}
        r={47}
        fill="var(--color-night)"
        stroke="var(--color-haze)"
        strokeWidth="2"
      />
      <circle
        cx={C}
        cy={C}
        r={36}
        fill="none"
        stroke="var(--color-rule)"
        strokeWidth="1"
      />
      {Array.from({ length: total }, (_, i) => {
        const a = (i / total) * 2 * Math.PI;
        const on = i < lit;
        const r1 = i % 5 === 0 ? 37 : 40;
        return (
          <line
            key={i}
            x1={C + Math.sin(a) * r1}
            y1={C - Math.cos(a) * r1}
            x2={C + Math.sin(a) * 44}
            y2={C - Math.cos(a) * 44}
            stroke={
              on
                ? low
                  ? "var(--color-flag)"
                  : "var(--color-ink)"
                : "var(--color-rule)"
            }
            strokeWidth={i % 5 === 0 ? 2.4 : 1.4}
          />
        );
      })}
      <text
        x={C}
        y={21}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="var(--color-flag)"
        className="font-sign"
      >
        N
      </text>
      {/* needle: red end leads, pale tail */}
      <g
        transform={`rotate(${angle} ${C} ${C})`}
        style={{ transition: active ? "transform 0.1s linear" : undefined }}
      >
        <path
          d={`M${C} ${C - 33} L${C + 4} ${C} L${C - 4} ${C} Z`}
          fill={low ? "var(--color-flag)" : "var(--color-alpenglow)"}
          opacity="0.85"
        />
        <path
          d={`M${C} ${C + 33} L${C + 4} ${C} L${C - 4} ${C} Z`}
          fill="var(--color-haze)"
          opacity="0.5"
        />
      </g>
      <circle
        cx={C}
        cy={C}
        r={15}
        fill="var(--color-night)"
        stroke="var(--color-rule)"
      />
      <text
        x={C}
        y={C + 7.5}
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill={low ? "var(--color-flag)" : "var(--color-ink)"}
        className="font-sign tabular-nums"
      >
        {seconds}
      </text>
    </svg>
  );
}

/**
 * Cloud bank that thickens as time runs out. Fixed behind the page content
 * (content sits on a higher layer), so it veils the scene, never the words.
 * Clouds are mid-dark blue-grey and capped in strength, so light text keeps
 * well over 4.5:1 contrast at the thickest.
 */
/** 0 = clear sky, 1 = thickest cloud: none for the first 40% of the clock, then building. */
export function cloudDensity(fraction: number, active: boolean) {
  return active ? Math.max(0, Math.min(1, (0.6 - fraction) / 0.5)) : 0;
}

export function Clouds({
  fraction,
  active,
}: {
  fraction: number;
  active: boolean;
}) {
  // nothing for the first half, then builds to full at zero
  const density = cloudDensity(fraction, active);
  const puffs = [
    { x: "-15%", y: "4%", w: "75%", h: "36%", d: 0 },
    { x: "40%", y: "0%", w: "80%", h: "34%", d: 0.05 },
    { x: "-25%", y: "30%", w: "85%", h: "34%", d: 0.2 },
    { x: "35%", y: "36%", w: "85%", h: "36%", d: 0.3 },
    { x: "-5%", y: "66%", w: "110%", h: "40%", d: 0.45 },
  ];
  return (
    <div
      className="clouds pointer-events-none fixed inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      {puffs.map((p, i) => {
        const own = Math.max(0, Math.min(1, (density - p.d) / (1 - p.d)));
        return (
          <div
            key={i}
            className={`cloud cloud-${i % 2 ? "east" : "west"}`}
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              opacity: own * 0.92,
            }}
          />
        );
      })}
    </div>
  );
}
