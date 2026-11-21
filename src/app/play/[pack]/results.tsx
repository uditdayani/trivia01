"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { DayRow } from "@/lib/game";
import { MAX_POINTS } from "@/lib/tiers";
import { emojiOf, formatDate, pointsOf, statLine, tierOf } from "./scoring";

export function Results({ packName, date, rows }: { packName: string; date: string; rows: DayRow[] }) {
  const total = rows.reduce((sum, r) => sum + pointsOf(r.result), 0);
  const correct = rows.filter((r) => r.result?.correct).length;
  const max = rows.length * MAX_POINTS;

  return (
    <section aria-labelledby="results-title">
      <p className="text-stone">
        {packName} · {formatDate(date)}
      </p>
      <h1 id="results-title" className="mt-1 font-sign text-6xl font-bold leading-none sm:text-7xl">
        {total} <span className="text-3xl text-stone sm:text-4xl">/ {max} points</span>
      </h1>
      <p className="mt-3 text-stone">
        {correct} of {rows.length} correct. Every answer&apos;s points were set before the day began.
      </p>

      <ShareCard packName={packName} date={date} rows={rows} total={total} max={max} />

      <ol className="mt-10 divide-y divide-mist border-y border-mist">
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
      <span className="font-sign text-lg font-semibold text-stone tabular-nums">{n}</span>
      <div>
        <p className="font-medium">{row.text ?? "Question not opened"}</p>
        <p className={tier ? "text-moss" : "text-flag"}>{describe(row)}</p>
        {tier && (
          <p className="text-sm text-stone">
            {tier.name}. {statLine(r)}
          </p>
        )}
        {row.topAnswers && row.topAnswers.length > 0 && (
          <p className="text-sm text-stone">Most given: {row.topAnswers.map((t) => t.name).join(", ")}</p>
        )}
      </div>
      <span className="text-right">
        <span className="block font-sign text-2xl font-bold tabular-nums">{pointsOf(r)}</span>
        <span aria-hidden="true">{emojiOf(r)}</span>
      </span>
    </li>
  );
}

const noSubscribe = () => () => {};

function describe(row: DayRow): string {
  const r = row.result;
  if (row.status === "expired" || (r && !r.input && !r.name)) return "No answer";
  if (row.status === "late") return `“${r?.input}” arrived after time ran out`;
  if (!r) return "No answer";
  if (r.correct) return `✓ ${r.name}`;
  if (r.name) return `✗ ${r.name}: not a correct answer here`;
  return `✗ “${r.input}” wasn't recognised`;
}

function ShareCard({
  packName,
  date,
  rows,
  total,
  max,
}: {
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
    `Rare-Answer Trivia: ${packName}, ${formatDate(date, "short")}`,
    `${rows.map((r) => emojiOf(r.result)).join("")} ${total}/${max}`,
    url,
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("manual");
    }
  }

  return (
    <div className="mt-8 rounded-md bg-glacier-soft/60 p-5">
      <pre className="whitespace-pre-wrap font-sans text-lg leading-snug" aria-label="Your result to share">
        {text}
      </pre>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-slate px-5 py-2.5 font-medium text-snow hover:bg-glacier"
        >
          Copy result
        </button>
        <span role="status" className="text-stone">
          {state === "copied" && "Copied. Paste it anywhere."}
          {state === "manual" && "Copying was blocked. Select the text above and copy it."}
        </span>
      </div>
    </div>
  );
}
