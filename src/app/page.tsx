import { Suspense } from "react";
import { connection } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { TIERS } from "@/lib/tiers";

type PromptRow = {
  id: number;
  text: string;
  time_limit_s: number;
  packs: { name: string } | null;
  answers: { count: number }[];
};

async function loadTestPrompt() {
  // Opt out of prerendering: always read fresh from the database.
  await connection();
  const supabase = getServerSupabase();
  if (!supabase) return { status: "no-env" as const };

  const { data, error } = await supabase
    .from("prompts")
    .select("id, text, time_limit_s, packs(name), answers(count)")
    .order("id")
    .limit(1)
    .maybeSingle<PromptRow>();

  if (error) return { status: "error" as const, message: error.message };
  if (!data) return { status: "empty" as const };
  return { status: "ok" as const, prompt: data };
}

async function ConnectionCheck() {
  const result = await loadTestPrompt();
  return (
    <>
      {result.status === "ok" && (
        <>
          <p className="text-sm text-slate-500">
            {result.prompt.packs?.name ?? "Unknown pack"} · {result.prompt.time_limit_s}s
          </p>
          <p className="mt-1 text-2xl font-semibold">{result.prompt.text}</p>
          <p className="mt-3 text-sm text-green-700">
            ✓ Read from Supabase · {result.prompt.answers[0]?.count ?? 0} accepted answers
          </p>
        </>
      )}
      {result.status === "no-env" && (
        <p className="text-amber-700">
          Supabase isn&apos;t configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and fill in your project URL and service-role key.
        </p>
      )}
      {result.status === "empty" && (
        <p className="text-amber-700">
          Connected, but no prompts found. Run <code>supabase/seed.sql</code>.
        </p>
      )}
      {result.status === "error" && (
        <p className="text-red-700">Supabase error: {result.message}</p>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">M0 · connection check</p>
        <h1 className="mt-2 text-3xl font-bold">Rare-Answer Trivia</h1>
        <p className="mt-2 text-slate-600">
          The rarer your correct answer, the more points you score.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 p-6">
        <Suspense fallback={<p className="text-slate-500">Connecting to Supabase…</p>}>
          <ConnectionCheck />
        </Suspense>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Tiers</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {TIERS.map((t) => (
            <li key={t.name} className="flex justify-between py-2">
              <span>
                {t.emoji} {t.name}
              </span>
              <span className="tabular-nums text-slate-600">
                {Number.isFinite(t.maxShare) ? `under ${t.maxShare * 100}%` : "most common"} ·{" "}
                {t.points} pts
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
