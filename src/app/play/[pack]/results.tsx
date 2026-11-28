"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { DayRow } from "@/lib/game";
import { MAX_POINTS, TIERS } from "@/lib/tiers";
import { track } from "@/lib/track";
import { RidgeProfile, altitudeOf } from "@/components/mountains";
import { colorOf, emojiOf, formatDate, pointsOf, statLine, tierOf, untilNextPuzzle } from "./scoring";

export function Results({
  pack,
  packName,
  date,
  rows,
}: {
  pack: string;
  packName: string;
  date: string;
  rows: DayRow[];
}) {
  const total = rows.reduce((sum, r) => sum + pointsOf(r.result), 0);
  const correct = rows.filter((r) => r.result?.correct).length;
  const max = rows.length * MAX_POINTS;
  const altitude = altitudeOf(total, max);
  // the highest of the six summits this climb got above
  const passed = [...TIERS].reverse().filter((t) => altitude >= t.elevation).pop();

  return (
    <section aria-labelledby="results-title">
      <p className="text-haze">
        {packName}, {formatDate(date)}
      </p>
      <h1 id="results-title" className="mt-1 font-sign text-6xl font-bold leading-none tabular-nums sm:text-8xl">
        {altitude.toLocaleString("en-GB")} m
      </h1>
      <p className="mt-3 text-lg text-haze">
        {total} of {max} points, {correct} of {rows.length} correct.{" "}
        {passed ? (
          <>
            You climbed higher than{" "}
            <span className="font-semibold" style={{ color: passed.color }}>
              {passed.name}
            </span>{" "}
            ({passed.elevation.toLocaleString("en-GB")} m).
          </>
        ) : (
          "Still at base camp today."
        )}
      </p>

      <div className="mt-6">
        <RidgeProfile results={rows.map((r) => ({ tier: r.result?.correct ? r.result.tier : null, points: pointsOf(r.result) }))} />
      </div>

      <ShareCard pack={pack} packName={packName} date={date} rows={rows} total={total} max={max} />

      <NextPuzzle />

      <ol className="mt-10 divide-y divide-rule border-y border-rule">
        {rows.map((r, i) => (
          <ResultRow key={r.promptId} row={r} n={i + 1} />
        ))}
      </ol>

      <Link href="/" className="mt-8 inline-block underline">
        Back to the start
      </Link>
    </section>
  );
}

function ResultRow({ row, n }: { row: DayRow; n: number }) {
  const tier = tierOf(row.result);
  const r = row.result;
  return (
    <li className="grid grid-cols-[1.75rem_1fr_auto] gap-x-3 py-4">
      <span className="font-sign text-lg font-semibold text-haze tabular-nums">{n}</span>
      <div>
        <p className="font-medium">{row.text ?? "Question not opened"}</p>
        <p style={{ color: colorOf(r) }}>{describe(row)}</p>
        {tier && (
          <p className="text-sm text-haze">
            <span className="font-semibold" style={{ color: tier.color }}>
              {tier.name}
            </span>
            . {statLine(r)}
          </p>
        )}
        {row.topAnswers && row.topAnswers.length > 0 && (
          <p className="text-sm text-haze">Most given: {row.topAnswers.map((t) => t.name).join(", ")}</p>
        )}
        <BetterAnswers row={row} />
      </div>
      <span className="text-right">
        <span className="block font-sign text-2xl font-bold tabular-nums" style={{ color: tier ? tier.color : undefined }}>
          {pointsOf(r)}
        </span>
        <span aria-hidden="true">{emojiOf(r)}</span>
      </span>
    </li>
  );
}

const noSubscribe = () => () => {};

/** Example answers from every tier above what the player scored, grouped by tier. */
function BetterAnswers({ row }: { row: DayRow }) {
  const scored = pointsOf(row.result);
  const mine = row.result?.name;
  const higher = TIERS.filter((t) => t.points > scored)
    .map((t) => ({ tier: t, names: (row.examples ?? []).filter((e) => e.tier === t.name && e.name !== mine) }))
    .filter((g) => g.names.length > 0);
  if (higher.length === 0) return null;
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-sm text-glacier underline-offset-2 hover:underline">
        <span className="group-open:hidden">See better answers</span>
        <span className="hidden group-open:inline">Hide better answers</span>
      </summary>
      <dl className="mt-2 space-y-1 text-sm">
        {higher.map(({ tier, names }) => (
          <div key={tier.name} className="grid grid-cols-[6.5rem_1fr] gap-2">
            <dt className="font-semibold" style={{ color: tier.color }}>
              {tier.name} <span className="font-normal text-haze">{tier.points}</span>
            </dt>
            <dd>{names.map((n) => n.name).join(", ")}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function NextPuzzle() {
  // recomputed on render; a minute-level countdown is enough here
  const label = useSyncExternalStore(
    (cb) => {
      const id = window.setInterval(cb, 30_000);
      return () => window.clearInterval(id);
    },
    () => untilNextPuzzle(),
    () => "",
  );
  if (!label) return null;
  return <p className="mt-4 text-haze">Next puzzle in {label} (midnight UTC).</p>;
}

function describe(row: DayRow): string {
  const r = row.result;
  const tried = row.tried?.length ?? 0;
  if (row.status === "expired" || (r && !r.input && !r.name)) {
    return tried > 0 ? `No correct answer (${tried} wrong ${tried === 1 ? "guess" : "guesses"})` : "No answer";
  }
  if (row.status === "late") return `“${r?.input}” arrived after time ran out`;
  if (!r) return "No answer";
  if (r.correct) return `✓ ${r.name}`;
  if (r.name) return `✗ ${r.name}: not a correct answer here`;
  return `✗ “${r.input}” wasn't recognised`;
}

function ShareCard({
  pack,
  packName,
  date,
  rows,
  total,
  max,
}: {
  pack: string;
  packName: string;
  date: string;
  rows: DayRow[];
  total: number;
  max: number;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  // the site's address, read only in the browser (empty during server render)
  const url = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const text = [
    `TriviaSummit: ${packName}, ${formatDate(date, "short")}`,
    `${rows.map((r) => emojiOf(r.result)).join("")} ${total}/${max}, ${altitudeOf(total, max).toLocaleString("en-GB")} m`,
    url,
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      track("result_copy", pack, date, { score: total });
    } catch {
      setState("manual");
    }
  }

  return (
    <div className="mt-8 border-y border-dashed border-haze/40 py-5">
      <pre className="whitespace-pre-wrap font-sans text-lg leading-snug" aria-label="Your result to share">
        {text}
      </pre>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={copy}
          className="btn btn-sign"
        >
          Copy result
        </button>
        <span role="status" className="text-haze">
          {state === "copied" && "Copied. Paste it anywhere."}
          {state === "manual" && "Copying was blocked. Select the text above and copy it."}
        </span>
      </div>
    </div>
  );
}
