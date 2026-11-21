import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GameError, PACKS, getTodaysPrompts, isPackSlug, puzzleDate, type PackSlug } from "@/lib/game";
import { Game } from "./game";

async function Puzzle({ params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  if (!isPackSlug(pack)) notFound();
  if (!PACKS[pack].live) {
    return <Notice title={`${PACKS[pack].name} isn't open yet`} body="Play Geography while it's being built." />;
  }

  await connection(); // today's puzzle depends on the date, so render per request
  const date = puzzleDate();
  let prompts: Awaited<ReturnType<typeof getTodaysPrompts>>;
  try {
    prompts = await getTodaysPrompts(pack as PackSlug, date);
  } catch (e) {
    const message = e instanceof GameError ? e.message : "The database didn't respond. Try again in a moment.";
    return <Notice title="The puzzle couldn't load" body={message} />;
  }
  if (prompts.length === 0) {
    return <Notice title="No questions loaded" body="Run supabase/data/geography.sql in the Supabase SQL editor." />;
  }
  return <Game pack={pack} packName={PACKS[pack].name} date={date} prompts={prompts} />;
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="font-sign text-4xl font-bold">{title}</h1>
      <p className="mt-3 text-stone">{body}</p>
      <Link href="/" className="mt-6 inline-block underline">
        Back to the start
      </Link>
    </div>
  );
}

export default function PlayPage({ params }: PageProps<"/play/[pack]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8">
      <Suspense fallback={<p className="text-stone">Loading today&apos;s questions…</p>}>
        <Puzzle params={params} />
      </Suspense>
    </main>
  );
}
