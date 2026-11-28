// Mountain drawings used across the site. Pure SVG, deterministic (no random at
// render time), so server and browser draw the same picture.
import { TIERS, tierByName } from "@/lib/tiers";

/** Small, seeded pseudo-random generator so ridges are irregular but stable. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A ridgeline by midpoint displacement: jagged like real mountains, not sine waves. */
function ridge(
  seed: number,
  width: number,
  base: number,
  rough: number,
  levels = 7,
): [number, number][] {
  const rand = seeded(seed);
  let pts: [number, number][] = [
    [0, base - rand() * rough],
    [width, base - rand() * rough],
  ];
  let amp = rough;
  for (let l = 0; l < levels; l++) {
    const next: [number, number][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      next.push(
        [x1, y1],
        [(x1 + x2) / 2, (y1 + y2) / 2 + (rand() - 0.62) * amp],
      );
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

function toPath(pts: [number, number][], bottom: number, width: number) {
  return (
    `M0 ${bottom} ` +
    pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    ` L${width} ${bottom} Z`
  );
}

/** The home page range: sky, a few stars, three ridges, alpenglow on the highest peak. */
export function MountainRange({ className = "" }: { className?: string }) {
  const W = 1200;
  const H = 460;
  // sky takes the top; the range rises from the bottom third
  const far = ridge(11, W, 360, 210);
  const mid = ridge(29, W, 405, 175);
  const near = ridge(47, W, 440, 60);
  // plant the flag on the front ridge's highest peak in the right half, clear of the headline
  // (between 58% and 65% across: visible on phones and clear of the headline on desktop)
  const peak = mid
    .filter(([x]) => x > W * 0.58 && x < W * 0.645)
    .reduce((a, b) => (b[1] < a[1] ? b : a));
  const rand = seeded(3);
  const stars = Array.from(
    { length: 46 },
    () => [rand() * W, rand() * 220, rand() * 1.1 + 0.4] as const,
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1322" />
          <stop offset="0.65" stopColor="#1c2140" />
          <stop offset="1" stopColor="#3a2c4a" />
        </linearGradient>
        <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            stopColor="var(--color-alpenglow)"
            stopOpacity="0.55"
          />
          <stop
            offset="0.35"
            stopColor="var(--color-alpenglow)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      {stars.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill="#eef1ec"
          opacity={0.25 + (i % 5) * 0.12}
        />
      ))}
      <path d={toPath(far, H, W)} fill="var(--color-ridge-far)" />
      <path d={toPath(far, H, W)} fill="url(#glow)" />
      <path d={toPath(mid, H, W)} fill="var(--color-ridge-mid)" />
      {/* summit flag on the front ridge's peak (desktop only: phones show a narrower slice) */}
      <g
        transform={`translate(${peak[0]} ${peak[1]})`}
        className="max-sm:hidden"
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="-22"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <path d="M0 -22 L13 -17.5 L0 -13 Z" fill="var(--color-sign)" />
      </g>
      <path d={toPath(near, H, W)} fill="var(--color-night)" />
    </svg>
  );
}

/** The wordmark's glyph: a two-peak summit with a flag. */
export function SummitMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden="true">
      <path d="M1 19 L10 5 L14 11 L18 3 L27 19 Z" fill="var(--color-ink)" />
      <path
        d="M18 3 L20.6 7.8 L18.6 7 L16.9 8.6 L15.8 7.4 Z"
        fill="var(--color-night)"
        opacity="0.55"
      />
      <line
        x1="18"
        y1="3"
        x2="18"
        y2="-1"
        stroke="var(--color-ink)"
        strokeWidth="1"
      />
      <path d="M18 -1 L22 0.2 L18 1.4 Z" fill="var(--color-sign)" />
    </svg>
  );
}

/** The six tiers as real summits, drawn to their true heights, side by side. */
export function PeakLadder() {
  const W = 600;
  const H = 270;
  const base = 205;
  const top = 24;
  const max = TIERS[0].elevation;
  const order = [...TIERS].reverse(); // Wycheproof on the left, Everest on the right
  const slot = W / order.length;
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="The six tiers drawn to their real heights, from Mount Wycheproof at 148 metres to Everest at 8,849 metres"
      >
        {order.map((t, i) => {
          const h = Math.max(((base - top) * t.elevation) / max, 5);
          const cx = slot * i + slot / 2;
          const half = Math.min(slot * 0.62, 30 + h * 0.48);
          const peakY = base - h;
          const snow = t.elevation > 3500;
          const snowH = h * 0.22;
          return (
            <g key={t.name}>
              <path
                d={`M${cx - half} ${base} L${cx} ${peakY} L${cx + half} ${base} Z`}
                fill={t.color}
                opacity="0.92"
              />
              {/* shadow side */}
              <path
                d={`M${cx} ${peakY} L${cx + half} ${base} L${cx + half * 0.25} ${base} Z`}
                fill="#000"
                opacity="0.18"
              />
              {snow && (
                <path
                  d={`M${cx - (half * snowH) / h} ${peakY + snowH} L${cx} ${peakY} L${cx + (half * snowH) / h} ${peakY + snowH} L${cx + (half * snowH) / h / 3} ${peakY + snowH * 0.75} L${cx - (half * snowH) / h / 4} ${peakY + snowH * 0.9} Z`}
                  fill="var(--color-ink)"
                  opacity="0.9"
                />
              )}
              <text
                x={cx}
                y={peakY - 9}
                textAnchor="middle"
                fontSize="19"
                fontWeight="700"
                fill={t.color}
                className="font-sign"
              >
                {t.points}
              </text>
              <text
                x={cx}
                y={base + 26}
                textAnchor="middle"
                fontSize="17"
                fontWeight="600"
                fill="var(--color-ink)"
                className="font-sign"
              >
                {t.name}
              </text>
              <text
                x={cx}
                y={base + 46}
                textAnchor="middle"
                fontSize="14"
                fill="var(--color-haze)"
              >
                {t.elevation.toLocaleString("en-GB")} m
              </text>
            </g>
          );
        })}
        <line x1="0" y1={base} x2={W} y2={base} stroke="var(--color-rule)" />
      </svg>
      <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {TIERS.map((t) => (
          <li key={t.name} className="flex gap-2">
            <span
              className="font-sign font-semibold"
              style={{ color: t.color }}
            >
              {t.name}
            </span>
            <span className="text-haze">{t.blurb}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Your day as a mountain range: one peak per question, as high as its points,
 * in its tier's colour. A wrong answer is a valley.
 */
export function RidgeProfile({
  results,
}: {
  results: { tier: string | null; points: number }[];
}) {
  const W = 700;
  const H = 230;
  const base = 200;
  const top = 26;
  const n = results.length;
  const step = W / n;
  const peaks = results.map((r, i) => {
    const x = step * i + step / 2;
    const y = base - ((base - top) * r.points) / 100;
    return { x, y, ...r, tier: tierByName(r.tier) };
  });
  // the ridgeline: peaks joined through cols (saddles) a little above base
  const line: [number, number][] = [[0, base - 6]];
  peaks.forEach((p, i) => {
    line.push([p.x, p.points > 0 ? p.y : base - 4]);
    if (i < n - 1) {
      const next = peaks[i + 1];
      const col = Math.max(
        p.points > 0 ? p.y : base,
        next.points > 0 ? next.y : base,
      );
      line.push([
        p.x + step / 2,
        Math.min(base - 4, col + (base - col) * 0.55),
      ]);
    }
  });
  line.push([W, base - 6]);
  const ridgeD =
    "M" + line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Your answers drawn as a mountain range: taller peaks for rarer answers"
    >
      <defs>
        <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-ridge-near)" />
          <stop offset="1" stopColor="var(--color-night)" />
        </linearGradient>
      </defs>
      <path d={`${ridgeD} L${W} ${H} L0 ${H} Z`} fill="url(#rock)" />
      {peaks.map((p, i) =>
        p.tier && p.points > 0 ? (
          <g key={i}>
            <path
              d={`M${p.x - step * 0.42} ${base} L${p.x} ${p.y} L${p.x + step * 0.42} ${base} Z`}
              fill={p.tier.color}
              opacity="0.95"
            />
            <path
              d={`M${p.x} ${p.y} L${p.x + step * 0.42} ${base} L${p.x + step * 0.1} ${base} Z`}
              fill="#000"
              opacity="0.2"
            />
            {p.points === 100 && (
              <g transform={`translate(${p.x} ${p.y})`}>
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-18"
                  stroke="var(--color-ink)"
                  strokeWidth="1.5"
                />
                <path d="M0 -18 L11 -14 L0 -10 Z" fill="var(--color-sign)" />
              </g>
            )}
          </g>
        ) : (
          <g key={i}>
            <line
              x1={p.x - 8}
              y1={base - 6}
              x2={p.x + 8}
              y2={base - 6}
              stroke="var(--color-flag)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ),
      )}
      <path
        d={ridgeD}
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <line x1="0" y1={base} x2={W} y2={base} stroke="var(--color-rule)" />
      {peaks.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={base + 20}
          textAnchor="middle"
          fontSize="13"
          fill="var(--color-haze)"
          className="font-sign"
        >
          {i + 1}
        </text>
      ))}
    </svg>
  );
}

/** Total points as altitude: a perfect 700 reaches the top of Everest. */
export function altitudeOf(points: number, maxPoints: number): number {
  return Math.round((points / maxPoints) * TIERS[0].elevation);
}

/**
 * The six tiers as a small range, lowest to highest, with the one this
 * answer reached filled in its colour and the rest left as outlines.
 * Shown straight after a correct answer so the player sees where it landed
 * and how much higher the question could have gone.
 */
export function PeakStrip({ reached }: { reached: string }) {
  const W = 300;
  const H = 74;
  const base = 52;
  const top = 6;
  const max = TIERS[0].elevation;
  const order = [...TIERS].reverse();
  const slot = W / order.length;
  const hit = order.find((t) => t.name === reached);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[300px]"
      role="img"
      aria-label={
        hit
          ? `${hit.name}, ${hit.points} points. The tiers run from Wycheproof, 20 points, to Everest, 100.`
          : undefined
      }
    >
      {order.map((t, i) => {
        const h = Math.max(((base - top) * t.elevation) / max, 3);
        const cx = slot * i + slot / 2;
        const half = Math.min(slot * 0.48, 8 + h * 0.5);
        const on = t.name === reached;
        const d = `M${cx - half} ${base} L${cx} ${base - h} L${cx + half} ${base} Z`;
        return (
          <g key={t.name}>
            {on ? (
              <>
                <path d={d} fill={t.color} />
                <path
                  d={`M${cx} ${base - h} L${cx + half} ${base} L${cx + half * 0.25} ${base} Z`}
                  fill="#000"
                  opacity="0.22"
                />
              </>
            ) : (
              <path
                d={d}
                fill="none"
                stroke="var(--color-rule)"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
            )}
            <text
              x={cx}
              y={base + 17}
              textAnchor="middle"
              fontSize="14"
              fontWeight={on ? 800 : 600}
              fill={on ? t.color : "var(--color-haze)"}
              opacity={on ? 1 : 0.7}
              className="font-sign"
            >
              {t.points}
            </text>
          </g>
        );
      })}
      <line x1="0" y1={base} x2={W} y2={base} stroke="var(--color-rule)" />
    </svg>
  );
}
