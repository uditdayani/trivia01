"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerResult, DayRow, RowStatus } from "@/lib/game";
import { Results } from "./results";
import { formatDate, statLine, tierOf } from "./scoring";

type Phase = "ready" | "opening" | "question" | "checking" | "feedback" | "finishing" | "done" | "error";

const FEEDBACK_MS = 1800;
const DONE: RowStatus[] = ["expired", "answered", "late"];

export function Game({
  pack,
  packName,
  date,
  initialRows,
}: {
  pack: string;
  packName: string;
  date: string;
  initialRows: DayRow[];
}) {
  const allDone = initialRows.every((r) => DONE.includes(r.status));
  const [rows, setRows] = useState<DayRow[]>(initialRows);
  const [phase, setPhase] = useState<Phase>(allDone ? "done" : "ready");
  const [index, setIndex] = useState(() => Math.max(0, initialRows.findIndex((r) => !DONE.includes(r.status))));
  const [input, setInput] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const deadline = useRef(0);
  const submitting = useRef(false);
  const inputValue = useRef("");
  useEffect(() => {
    inputValue.current = input;
  }, [input]);

  const row = rows[index];
  const answeredCount = rows.filter((r) => DONE.includes(r.status)).length;

  const finish = useCallback(async () => {
    setPhase("finishing");
    try {
      const res = await fetch(`/api/results?pack=${pack}&date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.rows);
    } catch {
      // keep the rows we have; points shown are from when each answer was given
    }
    setPhase("done");
  }, [pack, date]);

  const openQuestion = useCallback(
    async (i: number) => {
      const target = rows[i];
      if (!target) return finish();
      setIndex(i);
      setInput("");
      setPhase("opening");
      try {
        const res = await fetch("/api/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack, date, promptId: target.promptId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't open the question.");
        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, text: json.text, status: "in_progress" } : r)));
        submitting.current = false;
        deadline.current = performance.now() + json.remainingMs;
        setRemainingMs(json.remainingMs);
        setPhase("question");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't open the question.");
        setPhase("error");
      }
    },
    [rows, pack, date, finish],
  );

  const submit = useCallback(
    async (raw: string) => {
      if (submitting.current || !row) return;
      submitting.current = true;
      setPhase("checking");
      let result: AnswerResult;
      let status: RowStatus = "answered";
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack, date, promptId: row.promptId, input: raw.trim() }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't check that answer.");
        result = {
          input: json.input,
          name: json.name,
          correct: json.correct,
          tier: json.tier,
          points: json.points,
          nAnswer: json.nAnswer,
          nCorrect: json.nCorrect,
        };
        if (json.status === "late") status = "late";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't check that answer.");
        setPhase("error");
        return;
      }
      setRows((rs) => rs.map((r, j) => (j === index ? { ...r, status, result } : r)));
      setPhase("feedback");
    },
    [row, index, pack, date],
  );

  const next = useCallback(() => {
    const i = rows.findIndex((r, j) => j > index && !DONE.includes(r.status));
    if (i === -1) void finish();
    else void openQuestion(i);
  }, [rows, index, finish, openQuestion]);

  // countdown, driven by the server's remaining time
  useEffect(() => {
    if (phase !== "question") return;
    inputRef.current?.focus();
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline.current - performance.now());
      setRemainingMs(left);
      if (left === 0) {
        window.clearInterval(id);
        void submit(inputValue.current);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, submit]);

  useEffect(() => {
    if (phase !== "feedback") return;
    const id = window.setTimeout(next, FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [phase, next]);

  if (phase === "done") return <Results packName={packName} date={date} rows={rows} />;

  if (phase === "finishing") return <p className="text-stone">Adding up your points…</p>;

  if (phase === "error") {
    return (
      <div>
        <h1 className="font-sign text-4xl font-bold">Something got in the way</h1>
        <p className="mt-3 text-stone">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-slate px-5 py-3 font-medium text-snow hover:bg-glacier"
        >
          Reload the puzzle
        </button>
      </div>
    );
  }

  if (phase === "ready") {
    const resuming = answeredCount > 0 || rows.some((r) => r.status === "in_progress");
    return (
      <section aria-labelledby="ready-title">
        <p className="text-stone">
          {packName} · {formatDate(date)}
        </p>
        <h1 id="ready-title" className="mt-1 font-sign text-5xl font-bold leading-none sm:text-6xl">
          {resuming
            ? `${answeredCount} of ${rows.length} answered`
            : `${rows.length} questions, ${rows[0]?.timeLimitS ?? 30} seconds each`}
        </h1>
        <p className="mt-4 max-w-prose text-lg text-stone">
          {resuming
            ? "Pick up where you left off. A question you opened keeps its own clock, even if you left the page."
            : "One answer per question, one try per day. Each question appears only when you reach it, and its clock starts straight away."}
        </p>
        <button
          type="button"
          onClick={() => openQuestion(index)}
          className="mt-8 rounded-md bg-slate px-6 py-3 text-lg font-medium text-snow hover:bg-glacier"
        >
          {resuming ? "Continue" : "Start"}
        </button>
      </section>
    );
  }

  const limitMs = (row?.timeLimitS ?? 30) * 1000;
  // after answering, the bar holds the time that was left
  const fraction = phase === "opening" ? 1 : remainingMs / limitMs;
  const seconds = phase === "opening" ? row?.timeLimitS ?? 30 : Math.ceil(remainingMs / 1000);

  return (
    <section aria-labelledby="prompt-text">
      <div className="flex items-center justify-between text-stone">
        <span>
          Question {index + 1} of {rows.length}
        </span>
        <Progress rows={rows} index={index} />
      </div>

      <h1 id="prompt-text" className="mt-6 min-h-[2.5em] font-sign text-4xl font-bold leading-tight sm:text-5xl">
        {phase === "opening" ? <span className="text-stone">…</span> : row?.text}
      </h1>

      {/* horizon line: drains as time runs out */}
      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
              phase !== "question" ? "bg-stone/40" : fraction < 0.25 ? "bg-flag" : "bg-glacier"
            }`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <span className="w-8 text-right font-sign text-xl font-semibold tabular-nums">{seconds}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {phase === "question" && seconds <= 5 ? `${seconds} seconds left` : ""}
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (phase === "question") void submit(input);
        }}
      >
        <label htmlFor="answer" className="sr-only">
          Your answer
        </label>
        <input
          id="answer"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={phase !== "question"}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={80}
          placeholder={pack === "geography" ? "Type a country" : "Type an answer"}
          className="min-w-0 flex-1 rounded-md border-2 border-mist bg-white px-4 py-3 text-xl outline-none focus:border-glacier disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={phase !== "question"}
          className="rounded-md bg-slate px-5 py-3 font-medium text-snow hover:bg-glacier disabled:opacity-60"
        >
          Answer
        </button>
      </form>

      <div className="mt-5 min-h-28" aria-live="assertive">
        {phase === "checking" && <p className="text-stone">Checking…</p>}
        {phase === "feedback" && row?.result && (
          <div>
            <Feedback result={row.result} late={row.status === "late"} />
            <button type="button" onClick={next} className="mt-3 text-glacier underline">
              {rows.some((r, j) => j > index && !DONE.includes(r.status)) ? "Next question" : "See results"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Feedback({ result, late }: { result: AnswerResult; late: boolean }) {
  const tier = tierOf(result);
  if (late) {
    return <p className="rounded-md bg-mist px-4 py-3 text-lg">Time ran out before that answer arrived.</p>;
  }
  if (tier) {
    const stat = statLine(result);
    return (
      <div className="rounded-md bg-moss-soft px-4 py-3 text-moss">
        <p className="text-lg">
          <strong className="font-semibold">{result.name}</strong>: {tier.name}, {result.points} points.
        </p>
        {stat && <p>{stat}</p>}
      </div>
    );
  }
  if (result.name) {
    return (
      <p className="rounded-md bg-flag-soft px-4 py-3 text-lg text-flag">
        <strong className="font-semibold">{result.name}</strong> is a real country, but not a correct answer here.
      </p>
    );
  }
  if (!result.input) return <p className="rounded-md bg-mist px-4 py-3 text-lg">Time&apos;s up, no answer given.</p>;
  return (
    <p className="rounded-md bg-flag-soft px-4 py-3 text-lg text-flag">
      That isn&apos;t a country on our list. Check the spelling next time.
    </p>
  );
}

function Progress({ rows, index }: { rows: DayRow[]; index: number }) {
  return (
    <ol className="flex gap-1.5" aria-label="Progress">
      {rows.map((r, i) => {
        const done = DONE.includes(r.status);
        const color = done ? (r.result?.correct ? "bg-moss" : "bg-flag") : i === index ? "bg-slate" : "bg-mist";
        const label = done ? (r.result?.correct ? "correct" : "wrong") : i === index ? "current" : "to come";
        return (
          <li key={r.promptId} className={`h-2.5 w-5 rounded-sm ${color}`}>
            <span className="sr-only">
              Question {i + 1}: {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
