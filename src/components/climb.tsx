"use client";

// The day's route, side on. The mountain is drawn to the route's real height
// range, camps sit at their real altitudes, and the scenery is banded by the
// vegetation zones you pass through. The view follows the climber up.

import { useEffect, useRef, useState } from "react";
import {
  type Route,
  type ZoneKind,
  campAt,
  summitOf,
  zoneAt,
} from "@/lib/routes";

const W = 700;
const WORLD_H = 860;
const VIEW_H = 440;
const BASE_Y = WORLD_H - 60;
const TOP_Y = 64;
const SUMMIT_X = 430;
const LEFT_FOOT = 20;
const RIGHT_FOOT = 760;

/** Ground and sky for each zone kind, all drawn from the dusk palette. */
const GROUND: Record<ZoneKind, { fill: string; mark: string; sky: string }> = {
  forest: { fill: "#1d3530", mark: "#2f5a4b", sky: "#1c2843" },
  meadow: { fill: "#33402f", mark: "#56684a", sky: "#19243d" },
  desert: { fill: "#40384a", mark: "#5e5368", sky: "#162038" },
  glacier: { fill: "#a9bbd0", mark: "#7f95b0", sky: "#121b31" },
  deathzone: { fill: "#c9d3e0", mark: "#2a3042", sky: "#0b1122" },
};

function seeded(seed: string) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

type Geometry = {
  yOf: (alt: number) => number;
  leftX: (y: number) => number;
  face: string;
  trail: { x: number; y: number; alt: number; name: string; i: number }[];
};

function geometry(route: Route): Geometry {
  const lo = route.start.alt;
  const hi = summitOf(route).alt;
  const yOf = (alt: number) =>
    BASE_Y - ((alt - lo) / (hi - lo)) * (BASE_Y - TOP_Y);
  const leftX = (y: number) =>
    SUMMIT_X - ((y - TOP_Y) / (BASE_Y - TOP_Y)) * (SUMMIT_X - LEFT_FOOT);
  const rightX = (y: number) =>
    SUMMIT_X + ((y - TOP_Y) / (BASE_Y - TOP_Y)) * (RIGHT_FOOT - SUMMIT_X);

  // a ragged outline, the same every time this route is drawn
  const rand = seeded(route.id);
  const pts: [number, number][] = [[LEFT_FOOT - 40, WORLD_H]];
  const steps = 26;
  for (let k = 0; k <= steps; k++) {
    const y = BASE_Y + 40 - (k / steps) * (BASE_Y + 40 - TOP_Y);
    const jag = k === steps ? 0 : (rand() - 0.5) * 34;
    pts.push([leftX(y) - 18 + jag, y]);
  }
  pts.push([SUMMIT_X, TOP_Y - 4]);
  for (let k = steps; k >= 0; k--) {
    const y = BASE_Y + 40 - (k / steps) * (BASE_Y + 40 - TOP_Y);
    const jag = k === steps ? 0 : (rand() - 0.5) * 30;
    pts.push([rightX(y) + 14 + jag, y]);
  }
  pts.push([RIGHT_FOOT + 60, WORLD_H]);
  const face = `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

  // switchbacks: each stop alternates between the left and right of the face
  const all = [route.start, ...route.stops];
  const trail = all.map((s, i) => {
    const y = yOf(s.alt);
    const last = i === all.length - 1;
    const span = SUMMIT_X - leftX(y);
    const x = last ? SUMMIT_X : leftX(y) + span * (i % 2 === 0 ? 0.32 : 0.86);
    return { x, y, alt: s.alt, name: s.name, i };
  });
  return { yOf, leftX, face, trail };
}

/** Where on the trail a given altitude falls. */
function pointAt(g: Geometry, alt: number) {
  const t = g.trail;
  if (alt <= t[0].alt) return { x: t[0].x, y: t[0].y, seg: 0 };
  for (let i = 1; i < t.length; i++) {
    if (alt <= t[i].alt) {
      const a = t[i - 1];
      const b = t[i];
      const f = b.alt === a.alt ? 1 : (alt - a.alt) / (b.alt - a.alt);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, seg: i };
    }
  }
  const end = t[t.length - 1];
  return { x: end.x, y: end.y, seg: t.length };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Animate a number towards a target with an exponential ease-out. */
function useTween(target: number, ms: number, from?: number) {
  const [value, setValue] = useState(from ?? target);
  const current = useRef(from ?? target);
  useEffect(() => {
    const start = current.current;
    if (start === target) return;
    if (prefersReducedMotion()) {
      current.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * easeOutExpo(p);
      current.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function ClimbScene({
  route,
  altitude,
  from,
  resting = false,
  label,
}: {
  route: Route;
  /** metres reached so far */
  altitude: number;
  /** animate up from here on first draw (results screen) */
  from?: number;
  /** the last answer was wrong: pitch a tent where the climber stands */
  resting?: boolean;
  /** accessible description of where the climber is */
  label: string;
}) {
  const g = geometry(route);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = useRenderedWidth(svgRef);
  // keep labels at least 14px (names) and 12px (heights) on screen
  const nameSize = Math.max(21, (14 * W) / width);
  const altSize = Math.max(16, (12 * W) / width);
  const shown = useTween(altitude, from !== undefined ? 2600 : 1300, from);
  const here = pointAt(g, shown);
  const zone = zoneAt(route, shown);
  const palette = GROUND[zone.kind];

  const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, here.y - VIEW_H * 0.58));

  const lo = route.start.alt;
  const hi = summitOf(route).alt;
  const bands = route.zones.map((z, i) => {
    const top =
      i + 1 < route.zones.length ? route.zones[i + 1].from : hi + (hi - lo);
    return {
      z,
      y0: g.yOf(Math.min(top, hi + (hi - lo))),
      y1: i === 0 ? WORLD_H : g.yOf(z.from),
    };
  });

  const walked = [
    ...g.trail.slice(0, here.seg).map((p) => `${p.x} ${p.y}`),
    `${here.x} ${here.y}`,
  ];
  const ahead = [
    `${here.x} ${here.y}`,
    ...g.trail.slice(here.seg).map((p) => `${p.x} ${p.y}`),
  ];

  const rand = seeded(route.id + "marks");
  const marks: { x: number; y: number; kind: ZoneKind; s: number }[] = [];
  for (const b of bands) {
    const count = Math.round((b.y1 - b.y0) / 14);
    for (let k = 0; k < count; k++) {
      const y = b.y0 + rand() * (Math.min(b.y1, BASE_Y + 50) - b.y0);
      const lx = g.leftX(Math.max(y, TOP_Y));
      const rx = SUMMIT_X + (SUMMIT_X - lx) * 1.0;
      const x = lx + rand() * (rx - lx);
      marks.push({ x, y, kind: b.z.kind, s: 0.7 + rand() * 0.6 });
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${VIEW_H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id={`face-${route.id}`}>
          <path d={g.face} />
        </clipPath>
      </defs>
      <rect
        width={W}
        height={VIEW_H}
        fill={palette.sky}
        style={{ transition: "fill 1.2s ease-out" }}
      />
      {zone.kind === "deathzone" &&
        [80, 160, 260, 610, 660, 540].map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={30 + ((i * 53) % 120)}
            r={1.6}
            fill="var(--color-ink)"
            opacity="0.7"
          />
        ))}

      {/* far range, moving at half speed for depth */}
      <g transform={`translate(0 ${-camY * 0.5 + 160})`}>
        <path
          d="M-20 520 L60 380 L120 420 L190 330 L260 400 L330 350 L380 410 L700 420 L720 520 Z"
          fill="var(--color-ridge-far)"
        />
      </g>

      <g transform={`translate(0 ${-camY})`}>
        <g clipPath={`url(#face-${route.id})`}>
          {/* highest zone first; each lower zone is laid over it with a
              ragged upper edge, like a real treeline or snowline */}
          {[...bands].reverse().map(({ z, y0 }, k) => (
            <path
              key={z.name}
              d={raggedBand(route.id + k, y0)}
              fill={GROUND[z.kind].fill}
            />
          ))}
          {/* shadow side of the mountain */}
          <path
            d={`M${SUMMIT_X} ${TOP_Y - 4} L${RIGHT_FOOT + 60} ${WORLD_H} L${SUMMIT_X + 60} ${WORLD_H} Z`}
            fill="#000"
            opacity="0.22"
          />
          {marks.map((m, i) => (
            <Mark key={i} {...m} color={GROUND[m.kind].mark} />
          ))}
        </g>

        {/* the trail: walked in sign yellow, still to climb as a faint dashed line */}
        <polyline
          points={ahead.join(" ")}
          fill="none"
          stroke="var(--color-ink)"
          strokeOpacity="0.45"
          strokeWidth="2.5"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <polyline
          points={walked.join(" ")}
          fill="none"
          stroke="var(--color-sign)"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {labelLayout(g, nameSize).map(({ p, tx, ty, anchor }) => {
          const reached = p.alt <= shown + 0.5;
          const isStart = p.i === 0;
          return (
            <g key={p.i}>
              {isStart ? (
                <rect
                  x={p.x - 4}
                  y={p.y - 12}
                  width="8"
                  height="12"
                  fill={reached ? "var(--color-sign)" : "none"}
                  stroke="var(--color-night)"
                  strokeWidth="1.5"
                />
              ) : (
                <path
                  d={`M${p.x - 8} ${p.y + 1} L${p.x} ${p.y - 11} L${p.x + 8} ${p.y + 1} Z`}
                  fill={reached ? "var(--color-sign)" : "var(--color-night)"}
                  stroke={reached ? "var(--color-night)" : "var(--color-haze)"}
                  strokeWidth="1.5"
                />
              )}
              <text
                x={tx}
                y={ty}
                textAnchor={anchor}
                className="font-sign"
                fontSize={nameSize}
                fontWeight="700"
                fill={reached ? "var(--color-ink)" : "var(--color-haze)"}
                stroke="var(--color-night)"
                strokeWidth="5"
                paintOrder="stroke"
              >
                {p.name}
                <tspan
                  fontSize={altSize}
                  fontWeight="600"
                  dx="6"
                  fill="var(--color-haze)"
                >
                  {p.alt.toLocaleString("en-GB")} m
                </tspan>
              </text>
            </g>
          );
        })}

        <Climber x={here.x} y={here.y} resting={resting} />
      </g>
    </svg>
  );
}

/** A band filled from a wavy top edge down to the foot of the world. */
function raggedBand(seed: string, y0: number) {
  const rand = seeded(seed);
  const pts: string[] = [];
  for (let x = -100; x <= W + 100; x += 30) {
    pts.push(`${x} ${(y0 + (rand() - 0.5) * 22).toFixed(1)}`);
  }
  return `M${pts.join(" L")} L${W + 100} ${WORLD_H + 10} L-100 ${WORLD_H + 10} Z`;
}

/**
 * Where each camp's label goes: beside its camp, alternating sides with the
 * switchbacks, kept inside the frame, and nudged up when it would sit on top
 * of a label just below it on the same side.
 */
function labelLayout(g: Geometry, size: number) {
  const lastY: Record<string, number> = {};
  return g.trail.map((p) => {
    const isTop = p.i === g.trail.length - 1;
    // rough label width in viewBox units
    const w = p.name.length * size * 0.5 + size * 2.8;
    let onLeft = p.i % 2 === 0;
    if (onLeft && p.x - 16 - w < 6) onLeft = false;
    if (!onLeft && p.x + 16 + w > W - 6) onLeft = true;
    const side = isTop ? "top" : onLeft ? "left" : "right";
    let ty = isTop ? p.y - 22 : p.y + 6;
    const prev = lastY[side];
    if (prev !== undefined && prev - ty < size + 4) ty = prev - size - 4;
    lastY[side] = ty;
    return {
      p,
      ty,
      tx: isTop ? p.x : onLeft ? p.x - 16 : p.x + 16,
      anchor: (isTop ? "middle" : onLeft ? "end" : "start") as
        "middle" | "end" | "start",
    };
  });
}

function Mark({
  x,
  y,
  kind,
  s,
  color,
}: {
  x: number;
  y: number;
  kind: ZoneKind;
  s: number;
  color: string;
}) {
  switch (kind) {
    case "forest":
      return (
        <path
          d={`M${x} ${y - 16 * s} L${x + 6 * s} ${y} L${x - 6 * s} ${y} Z`}
          fill={color}
        />
      );
    case "meadow":
      return (
        <path
          d={`M${x - 5 * s} ${y} L${x - 2 * s} ${y - 6 * s} M${x} ${y} L${x} ${y - 8 * s} M${x + 5 * s} ${y} L${x + 2 * s} ${y - 6 * s}`}
          stroke={color}
          strokeWidth="1.6"
        />
      );
    case "desert":
      return (
        <path
          d={`M${x - 6 * s} ${y} L${x - 2 * s} ${y - 4 * s} L${x + 5 * s} ${y - 3 * s} L${x + 7 * s} ${y} Z`}
          fill={color}
        />
      );
    case "glacier":
      return (
        <path
          d={`M${x - 9 * s} ${y} L${x + 9 * s} ${y - 3 * s}`}
          stroke={color}
          strokeWidth="1.6"
        />
      );
    case "deathzone":
      return (
        <path
          d={`M${x - 7 * s} ${y} L${x} ${y - 5 * s} L${x + 7 * s} ${y} Z`}
          fill={color}
        />
      );
  }
}

function Climber({
  x,
  y,
  resting,
}: {
  x: number;
  y: number;
  resting: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      {resting && (
        <g transform="translate(14 0)">
          <path
            d="M0 0 L11 -15 L22 0 Z"
            fill="var(--color-flag)"
            stroke="var(--color-night)"
            strokeWidth="1.5"
          />
          <path
            d="M11 -15 L11 0"
            stroke="var(--color-night)"
            strokeWidth="1.5"
          />
        </g>
      )}
      {/* a walker with a pack and a pole */}
      <g stroke="var(--color-night)" strokeWidth="1.5" strokeLinejoin="round">
        <circle cx="0" cy="-25" r="4.5" fill="var(--color-sign)" />
        <path d="M-3 -20 L3 -20 L4 -8 L-4 -8 Z" fill="var(--color-sign)" />
        <path
          d="M-4 -19 L-9 -17 L-9 -9 L-4 -10 Z"
          fill="var(--color-alpenglow)"
        />
        <path
          d="M-2 -8 L-4 0 M2 -8 L4 0"
          stroke="var(--color-sign)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="M4 -16 L9 -2" stroke="var(--color-ink)" strokeWidth="1.5" />
      </g>
    </g>
  );
}

/** One line for screen readers and the readout under the scene. */
export function describeClimb(route: Route, altitude: number) {
  const camp = campAt(route, altitude);
  return { camp, zone: zoneAt(route, altitude) };
}

/** The SVG's width on screen in CSS pixels, kept current as the layout changes. */
function useRenderedWidth(ref: React.RefObject<SVGSVGElement | null>) {
  const [width, setWidth] = useState(W);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
