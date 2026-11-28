"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerResult, DayRow, RowStatus } from "@/lib/game";
import { Results } from "./results";
import { PeakStrip } from "@/components/mountains";
import { ClimbScene } from "@/components/climb";
import { Clouds, CompassTimer, cloudDensity } from "@/components/compass";
import {
  type Route as ClimbRoute,
  altitudeOn,
  campAt,
  formatMetres,
  nextCamp,
  routeFor,
  summitOf,
  zoneAt,
} from "@/lib/routes";
import { track } from "@/lib/track";
import { formatDate, pointsOf, statLine, tierOf } from "./scoring";

type Phase =
  | "ready"
  | "opening"
  | "question"
  | "checking"
  | "feedback"
  | "finishing"
  | "done"
  | "error";

const FEEDBACK_MS = 1800;
const DONE: RowStatus[] = ["expired", "answered", "late"];

export function Game({
  pack,
  packName,
  noun,
  date,
  initialRows,
}: {
  pack: string;
  packName: string;
  /** what an answer is: "country", "player" */
  noun: string;
  date: string;
  initialRows: DayRow[];
}) {
  const allDone = initialRows.every((r) => DONE.includes(r.status));
  const [rows, setRows] = useState<DayRow[]>(initialRows);
  const [phase, setPhase] = useState<Phase>(allDone ? "done" : "ready");
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      initialRows.findIndex((r) => !DONE.includes(r.status)),
    ),
  );
  const [input, setInput] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState("");
  const [endedByTime, setEndedByTime] = useState(false);
  const [retry, setRetry] = useState<{
    name: string | null;
    input: string;
    guessesLeft: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const deadline = useRef(0);
  const submitting = useRef(false);
  const inputValue = useRef("");
  useEffect(() => {
    inputValue.current = input;
  }, [input]);

  useEffect(() => {
    track("puzzle_view", pack, date, { finished: allDone });
    // once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = rows[index];
  const answeredCount = rows.filter((r) => DONE.includes(r.status)).length;
  const route = routeFor(pack, date);
  const totalPoints = rows.reduce((sum, r) => sum + pointsOf(r.result), 0);
  const altitude = altitudeOn(route, totalPoints);

  const finish = useCallback(async () => {
    setPhase("finishing");
    try {
      const res = await fetch(`/api/results?pack=${pack}&date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.rows);
      const final = json.rows as DayRow[];
      track("game_finish", pack, date, {
        score: final.reduce((sum, r) => sum + pointsOf(r.result), 0),
        correct: final.filter((r) => r.result?.correct).length,
      });
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
        if (!res.ok)
          throw new Error(json.error ?? "Couldn't open the question.");
        setRows((rs) =>
          rs.map((r, j) =>
            j === i ? { ...r, text: json.text, status: "in_progress" } : r,
          ),
        );
        submitting.current = false;
        timeUp.current = false;
        setRetry(null);
        deadline.current = performance.now() + json.remainingMs;
        setRemainingMs(json.remainingMs);
        setPhase("question");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't open the question.",
        );
        setPhase("error");
      }
    },
    [rows, pack, date, finish],
  );

  const timeUp = useRef(false);
  const submitRef = useRef<
    ((raw: string, final?: boolean) => Promise<void>) | null
  >(null);

  /** Send a guess. final = the clock ran out, so this guess ends the question. */
  const submit = useCallback(
    async (raw: string, final = false) => {
      if (submitting.current || !row) return;
      const guess = raw.trim();
      if (!guess && !final) return; // ignore Enter on an empty box
      submitting.current = true;
      setPhase("checking");
      let json: {
        status: "answered" | "retry" | "late" | "duplicate";
        input: string;
        name: string | null;
        correct: boolean;
        tier: string | null;
        points: number;
        nAnswer: number | null;
        nCorrect: number | null;
        guessesLeft: number;
      };
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pack,
            date,
            promptId: row.promptId,
            input: guess,
            final,
          }),
        });
        json = await res.json();
        if (!res.ok)
          throw new Error(
            (json as unknown as { error?: string }).error ??
              "Couldn't check that answer.",
          );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't check that answer.",
        );
        setPhase("error");
        return;
      }

      if (json.status === "retry") {
        setRows((rs) =>
          rs.map((r, j) =>
            j === index ? { ...r, tried: [...r.tried, json.name ?? guess] } : r,
          ),
        );
        setRetry({
          name: json.name,
          input: guess,
          guessesLeft: json.guessesLeft,
        });
        setInput("");
        submitting.current = false;
        if (timeUp.current || deadline.current - performance.now() <= 0) {
          void submitRef.current?.("", true); // time ran out while we were checking
        } else {
          setPhase("question");
        }
        return;
      }

      const result: AnswerResult = {
        input: json.input,
        name: json.name,
        correct: json.correct,
        tier: json.tier,
        points: json.points,
        nAnswer: json.nAnswer,
        nCorrect: json.nCorrect,
      };
      const status: RowStatus = json.status === "late" ? "late" : "answered";
      setRows((rs) =>
        rs.map((r, j) => (j === index ? { ...r, status, result } : r)),
      );
      setRetry(null);
      setEndedByTime(final && !result.correct);
      setPhase("feedback");
    },
    [row, index, pack, date],
  );
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const next = useCallback(() => {
    const i = rows.findIndex((r, j) => j > index && !DONE.includes(r.status));
    if (i === -1) void finish();
    else void openQuestion(i);
  }, [rows, index, finish, openQuestion]);

  // countdown, driven by the server's remaining time
  useEffect(() => {
    if (phase !== "question" && phase !== "checking") return;
    if (phase === "question") inputRef.current?.focus();
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline.current - performance.now());
      setRemainingMs(left);
      if (left === 0) {
        window.clearInterval(id);
        timeUp.current = true;
        // if a guess is being checked, its reply handles the time-up
        if (phase === "question") void submit(inputValue.current, true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, submit]);

  useEffect(() => {
    if (phase !== "feedback") return;
    const id = window.setTimeout(next, FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [phase, next]);

  if (phase === "done")
    return <Results pack={pack} packName={packName} date={date} rows={rows} />;

  if (phase === "finishing")
    return <p className="text-haze">Adding up your points…</p>;

  if (phase === "error") {
    return (
      <div>
        <h1 className="font-sign text-4xl font-bold">
          Something got in the way
        </h1>
        <p className="mt-3 text-haze">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-snow mt-6"
        >
          Reload the puzzle
        </button>
      </div>
    );
  }

  if (phase === "ready") {
    const resuming =
      answeredCount > 0 || rows.some((r) => r.status === "in_progress");
    return (
      <section aria-labelledby="ready-title">
        <p className="text-haze">
          {packName}, {formatDate(date)}
        </p>
        <h1
          id="ready-title"
          className="mt-1 font-sign text-5xl font-bold leading-[0.95] sm:text-6xl"
        >
          {route.title}
        </h1>
        <p className="mt-3 text-lg text-haze">
          {route.region}. From {route.start.name} at{" "}
          {formatMetres(route.start.alt)} to {summitOf(route).name} at{" "}
          {formatMetres(summitOf(route).alt)}.
        </p>
        <div className="mt-6">
          <ClimbReadout route={route} altitude={altitude} resting={false} />
        </div>
        <p className="mt-6 max-w-prose text-lg text-haze">
          {resuming
            ? `${answeredCount} of ${rows.length} answered. A question you opened keeps its own clock, even if you left the page.`
            : `${rows.length} questions, ${rows[0]?.timeLimitS ?? 30} seconds each. Every correct answer moves you up the trail, and the less expected it is, the further you climb. A perfect day reaches ${summitOf(route).name}.`}
        </p>
        <button
          type="button"
          onClick={() => {
            if (!resuming) track("game_start", pack, date);
            void openQuestion(index);
          }}
          className="btn btn-sign mt-8 text-lg"
        >
          {resuming ? "Continue the climb" : "Start the climb"}
        </button>
      </section>
    );
  }

  const limitMs = (row?.timeLimitS ?? 30) * 1000;
  // after answering, the bar holds the time that was left
  const fraction = phase === "opening" ? 1 : remainingMs / limitMs;
  const seconds =
    phase === "opening"
      ? (row?.timeLimitS ?? 30)
      : Math.ceil(remainingMs / 1000);

  const clockRunning = phase === "question" || phase === "checking";
  const resting = phase === "feedback" && !row?.result?.correct;

  return (
    <section
      aria-labelledby="prompt-text"
      style={
        {
          "--cloud": cloudDensity(fraction, clockRunning),
        } as React.CSSProperties
      }
    >
      <Clouds fraction={fraction} active={clockRunning} />
      <p className="over-cloud relative z-20 font-sign text-2xl font-bold leading-tight">
        {route.title}
      </p>
      <div className="mt-3">
        <ClimbReadout route={route} altitude={altitude} resting={resting} />
      </div>

      <div className="over-cloud relative z-20 mt-6 flex items-center justify-between gap-4">
        <span className="text-haze">
          Question {index + 1} of {rows.length}
        </span>
        <Route rows={rows} index={index} />
      </div>
      <h1
        id="prompt-text"
        className="over-cloud relative z-20 mt-3 min-h-[2.5em] text-3xl font-bold leading-snug sm:text-4xl"
      >
        {phase === "opening" ? <span className="text-haze">…</span> : row?.text}
      </h1>

      <p className="sr-only" aria-live="polite">
        {phase === "question" && seconds <= 5 ? `${seconds} seconds left` : ""}
      </p>

      <form
        className="over-cloud relative z-20 mt-5 flex items-center gap-2"
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
          placeholder={`Type a ${noun}`}
          className="min-w-0 flex-1 border-0 border-b-2 border-haze/60 bg-transparent px-1 py-3 text-2xl outline-none placeholder:text-haze/60 focus:border-sign disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={phase !== "question"}
          className="btn btn-snow"
        >
          Answer
        </button>
        <CompassTimer
          seconds={seconds}
          total={row?.timeLimitS ?? 30}
          fraction={fraction}
          active={clockRunning}
        />
      </form>

      <div
        className="over-cloud relative z-20 mt-5 min-h-28"
        aria-live="assertive"
      >
        {(phase === "question" || phase === "checking") && (
          <div>
            {retry && (
              <p className="text-lg">
                {retry.name ? (
                  <>
                    <strong className="text-flag">{retry.name}</strong>{" "}
                    isn&apos;t a correct answer.
                  </>
                ) : (
                  <>
                    <strong className="text-flag">“{retry.input}”</strong>{" "}
                    isn&apos;t a {noun} we know.
                  </>
                )}{" "}
                Try again.
                {retry.guessesLeft <= 3 && (
                  <span className="text-haze">
                    {" "}
                    {retry.guessesLeft}{" "}
                    {retry.guessesLeft === 1 ? "guess" : "guesses"} left.
                  </span>
                )}
              </p>
            )}
            {row && row.tried.length > 0 && (
              <p className="mt-2 text-haze">
                Tried{" "}
                {row.tried.map((t, i) => (
                  <span key={i}>
                    <s className="text-ink decoration-flag decoration-2">{t}</s>
                    {i < row.tried.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>
            )}
            {phase === "checking" && !retry && (
              <p className="text-haze">Checking…</p>
            )}
          </div>
        )}
        {phase === "feedback" && row?.result && (
          <div>
            <Feedback
              result={row.result}
              late={row.status === "late"}
              timeUp={endedByTime}
              noun={noun}
              guesses={row.tried.length}
            />
            <ClimbNote
              route={route}
              before={altitudeOn(route, totalPoints - pointsOf(row.result))}
              after={altitude}
            />
            <button
              type="button"
              onClick={next}
              className="mt-3 text-glacier underline"
            >
              {rows.some((r, j) => j > index && !DONE.includes(r.status))
                ? "Next question"
                : "See results"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Feedback({
  result,
  late,
  timeUp,
  noun,
  guesses,
}: {
  result: AnswerResult;
  late: boolean;
  timeUp: boolean;
  noun: string;
  /** wrong guesses already made on this question */
  guesses: number;
}) {
  const tier = tierOf(result);
  const prefix = timeUp && result.input ? "Time's up. " : "";
  if (late) {
    return (
      <p className="text-lg text-haze">
        Time ran out before that answer arrived.
      </p>
    );
  }
  if (tier) {
    const stat = statLine(result);
    return (
      <div>
        <div className="flex items-end gap-4">
          <span
            className="font-sign text-6xl font-extrabold leading-[0.8] tabular-nums"
            style={{ color: tier.color }}
          >
            +{result.points}
          </span>
          <div className="pb-0.5">
            <p
              className="flex items-center gap-2 font-sign text-2xl font-bold leading-none"
              style={{ color: tier.color }}
            >
              <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
                <path d="M1 15 L12 2 L23 15 Z" fill="currentColor" />
                <path d="M12 2 L23 15 L15 15 Z" fill="#000" opacity="0.25" />
              </svg>
              {tier.name}
            </p>
            <p className="mt-1.5 text-lg">
              <strong>{result.name}</strong> is correct.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <PeakStrip reached={tier.name} />
        </div>
        {stat && <p className="mt-2 text-sm text-haze">{stat}</p>}
      </div>
    );
  }
  if (result.name) {
    return (
      <p className="text-lg">
        {prefix}
        <strong className="text-flag">{result.name}</strong> is a real {noun},
        but not a correct answer here.
      </p>
    );
  }
  if (!result.input) {
    return (
      <p className="text-lg text-haze">
        {guesses > 0
          ? `Time's up. None of your ${guesses} ${guesses === 1 ? "guess was" : "guesses were"} right.`
          : "Time's up, no answer given."}
      </p>
    );
  }
  return (
    <p className="text-lg">
      {prefix}
      <strong className="text-flag">“{result.input}”</strong> isn&apos;t a{" "}
      {noun} we know.
    </p>
  );
}

/** The day's seven questions as marks: done ones take their tier's colour. */
function Route({ rows, index }: { rows: DayRow[]; index: number }) {
  return (
    <ol className="relative flex items-center gap-1" aria-label="Questions">
      <span
        className="absolute inset-x-2 top-1/2 h-0 border-t-2 border-dashed border-rule"
        aria-hidden="true"
      />
      {rows.map((r, i) => {
        const done = DONE.includes(r.status);
        const tier = done ? tierOf(r.result) : null;
        const current = i === index && !done;
        const label = done
          ? tier
            ? `${tier.name}, ${r.result?.points} points`
            : "no points"
          : current
            ? "you are here"
            : "to come";
        return (
          <li
            key={r.promptId}
            className="relative z-10 flex h-6 w-6 items-center justify-center"
          >
            {done && tier ? (
              <svg viewBox="0 0 24 20" className="h-5 w-6" aria-hidden="true">
                <path
                  d="M1 19 L12 2 L23 19 Z"
                  fill={tier.color}
                  stroke="var(--color-night)"
                  strokeWidth="1.5"
                />
                <path d="M12 2 L23 19 L15 19 Z" fill="#000" opacity="0.22" />
              </svg>
            ) : done ? (
              <svg
                viewBox="0 0 12 12"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path
                  d="M2 2 L10 10 M10 2 L2 10"
                  stroke="var(--color-flag)"
                  strokeWidth="2.2"
                  strokeLinecap="square"
                />
              </svg>
            ) : (
              <span
                className={`h-3.5 w-3.5 rotate-45 border-2 ${
                  current
                    ? "camp-current border-sign bg-sign"
                    : "border-haze/60 bg-night"
                }`}
                aria-hidden="true"
              />
            )}
            <span className="sr-only">
              Camp {i + 1}: {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The scene plus a plain-text line saying where you are and what's next. */
function ClimbReadout({
  route,
  altitude,
  resting,
}: {
  route: ClimbRoute;
  altitude: number;
  resting: boolean;
}) {
  const camp = campAt(route, altitude);
  const ahead = nextCamp(route, altitude);
  const zone = zoneAt(route, altitude);
  const where =
    camp.alt === altitude || altitude === route.start.alt
      ? `at ${camp.name}`
      : `above ${camp.name}`;
  return (
    <figure>
      <div className="border-y border-rule">
        <ClimbScene
          route={route}
          altitude={altitude}
          resting={resting}
          label={`${route.title}. You are ${where}, ${formatMetres(altitude)}, in ${zone.name.toLowerCase()}.`}
        />
      </div>
      <figcaption className="over-cloud relative z-20 mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-sign text-xl font-bold">
          {formatMetres(altitude)}
          <span className="ml-2 font-sans text-base font-normal text-haze">
            {zone.name}
          </span>
        </span>
        <span className="text-haze">
          {ahead
            ? `Next: ${ahead.name}, ${formatMetres(ahead.alt)}`
            : `On ${camp.name}`}
        </span>
      </figcaption>
    </figure>
  );
}

/** After an answer: how far it carried you, or that you hold where you are. */
function ClimbNote({
  route,
  before,
  after,
}: {
  route: ClimbRoute;
  before: number;
  after: number;
}) {
  if (after <= before) {
    return (
      <p className="mt-3 text-haze">
        You hold at {formatMetres(after)} and pitch a tent.
      </p>
    );
  }
  const passed = route.stops.filter((s) => s.alt > before && s.alt <= after);
  const names = passed.map((s) => s.name);
  const list =
    names.length <= 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    <p className="mt-3 text-haze">
      Climbed {formatMetres(after - before)} to {formatMetres(after)}
      {list ? `, past ${list}` : ""}.
    </p>
  );
}
