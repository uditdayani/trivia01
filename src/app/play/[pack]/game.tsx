"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PuzzlePrompt } from "@/lib/game";

type Verdict =
  | { status: "correct"; name: string }
  | { status: "wrong-entity"; name: string }
  | { status: "unrecognised" }
  | { status: "skipped" }
  | { status: "error"; message: string };

type Result = { prompt: PuzzlePrompt; input: string; verdict: Verdict };

type Phase = "ready" | "question" | "checking" | "feedback" | "done";

const FEEDBACK_MS = 1600;

export function Game({
  pack,
  packName,
  date,
  prompts,
}: {
  pack: string;
  packName: string;
  date: string;
  prompts: PuzzlePrompt[];
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const deadline = useRef(0);
  const submitting = useRef(false);
  const inputValue = useRef("");
  useEffect(() => {
    inputValue.current = input;
  }, [input]);

  const prompt = prompts[index];
  const limitMs = (prompt?.timeLimitS ?? 30) * 1000;

  const startQuestion = useCallback(
    (i: number) => {
      setIndex(i);
      setInput("");
      submitting.current = false;
      deadline.current = performance.now() + (prompts[i].timeLimitS ?? 30) * 1000;
      setRemainingMs((prompts[i].timeLimitS ?? 30) * 1000);
      setPhase("question");
    },
    [prompts],
  );

  const submit = useCallback(
    async (raw: string) => {
      if (submitting.current || !prompt) return;
      submitting.current = true;
      const answer = raw.trim();
      if (!answer) {
        setResults((r) => [...r, { prompt, input: "", verdict: { status: "skipped" } }]);
        setPhase("feedback");
        return;
      }
      setPhase("checking");
      let verdict: Verdict;
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack, promptId: prompt.id, input: answer }),
        });
        const json = await res.json();
        verdict = res.ok ? (json as Verdict) : { status: "error", message: json.error ?? "Couldn't check that answer." };
      } catch {
        verdict = { status: "error", message: "No connection. Your answer wasn't checked." };
      }
      setResults((r) => [...r, { prompt, input: answer, verdict }]);
      setPhase("feedback");
    },
    [pack, prompt],
  );

  const next = useCallback(() => {
    if (index + 1 < prompts.length) startQuestion(index + 1);
    else setPhase("done");
  }, [index, prompts.length, startQuestion]);

  // countdown
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

  // auto-advance after feedback
  useEffect(() => {
    if (phase !== "feedback") return;
    const id = window.setTimeout(next, FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [phase, next]);

  if (phase === "ready") {
    return (
      <section aria-labelledby="ready-title">
        <p className="text-stone">
          {packName} · {formatDate(date)}
        </p>
        <h1 id="ready-title" className="mt-1 font-sign text-5xl font-bold leading-none sm:text-6xl">
          {prompts.length} questions, {prompts[0]?.timeLimitS ?? 30} seconds each
        </h1>
        <p className="mt-4 max-w-prose text-lg text-stone">
          Type one answer per question and press Enter. Spelling doesn&apos;t have to be perfect. The clock
          starts as soon as you begin.
        </p>
        <button
          type="button"
          onClick={() => startQuestion(0)}
          className="mt-8 rounded-md bg-slate px-6 py-3 text-lg font-medium text-snow hover:bg-glacier"
        >
          Start
        </button>
      </section>
    );
  }

  if (phase === "done") {
    return <Results packName={packName} date={date} results={results} />;
  }

  const current = results[index];
  const fraction = remainingMs / limitMs;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <section aria-labelledby="prompt-text">
      <div className="flex items-center justify-between text-stone">
        <span>
          Question {index + 1} of {prompts.length}
        </span>
        <Progress total={prompts.length} results={results} index={index} />
      </div>

      <h1 id="prompt-text" className="mt-6 font-sign text-4xl font-bold leading-tight sm:text-5xl">
        {prompt.text}
      </h1>

      {/* horizon line: drains as time runs out */}
      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
              fraction < 0.25 ? "bg-flag" : "bg-glacier"
            }`}
            style={{ width: `${(phase === "question" ? fraction : 0) * 100}%` }}
          />
        </div>
        <span className="w-8 text-right font-sign text-xl font-semibold tabular-nums">
          {phase === "question" ? seconds : 0}
        </span>
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

      <div className="mt-5 min-h-24" aria-live="assertive">
        {phase === "checking" && <p className="text-stone">Checking…</p>}
        {phase === "feedback" && current && (
          <div>
            <Feedback verdict={current.verdict} />
            <button type="button" onClick={next} className="mt-3 text-glacier underline">
              {index + 1 < prompts.length ? "Next question" : "See results"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Feedback({ verdict }: { verdict: Verdict }) {
  switch (verdict.status) {
    case "correct":
      return (
        <p className="rounded-md bg-moss-soft px-4 py-3 text-lg text-moss">
          <strong className="font-semibold">{verdict.name}</strong> is correct.
        </p>
      );
    case "wrong-entity":
      return (
        <p className="rounded-md bg-flag-soft px-4 py-3 text-lg text-flag">
          <strong className="font-semibold">{verdict.name}</strong> is a real country, but not a correct answer here.
        </p>
      );
    case "unrecognised":
      return (
        <p className="rounded-md bg-flag-soft px-4 py-3 text-lg text-flag">
          That isn&apos;t a country on our list. Check the spelling next time.
        </p>
      );
    case "skipped":
      return <p className="rounded-md bg-mist px-4 py-3 text-lg">Time&apos;s up, no answer given.</p>;
    case "error":
      return <p className="rounded-md bg-flag-soft px-4 py-3 text-lg text-flag">{verdict.message}</p>;
  }
}

function Progress({ total, results, index }: { total: number; results: Result[]; index: number }) {
  return (
    <ol className="flex gap-1.5" aria-label="Progress">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const color = r
          ? r.verdict.status === "correct"
            ? "bg-moss"
            : "bg-flag"
          : i === index
            ? "bg-slate"
            : "bg-mist";
        const label = r ? (r.verdict.status === "correct" ? "correct" : "wrong") : i === index ? "current" : "to come";
        return (
          <li key={i} className={`h-2.5 w-5 rounded-sm ${color}`}>
            <span className="sr-only">
              Question {i + 1}: {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Results({ packName, date, results }: { packName: string; date: string; results: Result[] }) {
  const correct = results.filter((r) => r.verdict.status === "correct").length;
  return (
    <section aria-labelledby="results-title">
      <p className="text-stone">
        {packName} · {formatDate(date)}
      </p>
      <h1 id="results-title" className="mt-1 font-sign text-5xl font-bold leading-none sm:text-6xl">
        {correct} of {results.length} correct
      </h1>
      <p className="mt-3 max-w-prose text-stone">
        Rarity points come next: once enough people play, each correct answer will show how high it climbed.
      </p>

      <ol className="mt-8 divide-y divide-mist border-y border-mist">
        {results.map((r, i) => (
          <li key={r.prompt.id} className="grid grid-cols-[1.75rem_1fr] gap-x-3 py-4">
            <span className="font-sign text-lg font-semibold text-stone tabular-nums">{i + 1}</span>
            <div>
              <p className="font-medium">{r.prompt.text}</p>
              <p className={r.verdict.status === "correct" ? "text-moss" : "text-flag"}>
                {describe(r)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-slate px-5 py-3 font-medium text-snow hover:bg-glacier"
        >
          Play again
        </button>
        <Link href="/" className="self-center underline">
          Back to the start
        </Link>
      </div>
    </section>
  );
}

function describe({ input, verdict }: Result): string {
  switch (verdict.status) {
    case "correct":
      return `✓ ${verdict.name}`;
    case "wrong-entity":
      return `✗ ${verdict.name}: not a correct answer here`;
    case "unrecognised":
      return `✗ “${input}” wasn't recognised`;
    case "skipped":
      return "✗ No answer";
    case "error":
      return `✗ Not checked: ${verdict.message}`;
  }
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
