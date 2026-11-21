import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DONE, GameError, PACKS, getDay, isPackSlug, puzzleDate, withTopAnswers, type DayRow } from "@/lib/game";
import { readPlayerId } from "@/lib/player";
import { Game } from "./game";

async function Puzzle({ params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  if (!isPackSlug(pack)) notFound();
  if (!PACKS[pack].live) {
    return <Notice title={`${PACKS[pack].name} isn't open yet`} body="Play Geography while it's being built." />;
  }

  await connection(); // depends on today's date and the player's cookie
  const date = puzzleDate();
  let rows: DayRow[];
  try {
    const playerId = await readPlayerId();
    rows = await getDay(pack, date, playerId);
    if (rows.length > 0 && rows.every((r) => DONE.includes(r.status))) rows = await withTopAnswers(rows, date);
  } catch (e) {
    const message = e instanceof GameError ? e.message : "The database didn't respond. Try again in a moment.";
    return <Notice title="The puzzle couldn't load" body={message} />;
  }
  if (rows.length === 0) {
    return <Notice title="No questions loaded" body="Run supabase/data/geography.sql in the Supabase SQL editor." />;
  }
  return <Game pack={pack} packName={PACKS[pack].name} date={date} initialRows={rows} />;
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
