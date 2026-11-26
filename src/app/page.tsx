import Link from "next/link";
import { ElevationLadder } from "@/components/elevation-ladder";
import { PACKS } from "@/lib/game";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-10 pt-10 sm:pt-16">
      <h1 className="font-sign text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
        Name what nobody else thinks of.
      </h1>
      <p className="mt-5 max-w-prose text-lg text-haze">
        Seven questions a day, thirty seconds each. Every correct answer scores, and the less obvious
        it is, the higher it climbs.
      </p>

      <section aria-labelledby="packs" className="mt-10">
        <h2 id="packs" className="sr-only">
          Choose a pack
        </h2>
        <ul className="divide-y divide-rule border-y border-rule">
          {(Object.keys(PACKS) as (keyof typeof PACKS)[]).map((slug) => (
            <li key={slug}>
              <Link
                href={`/play/${slug}`}
                className="group -mx-3 flex items-baseline justify-between gap-4 rounded-md px-3 py-5 hover:bg-panel"
              >
                <span>
                  <span className="block font-sign text-3xl font-bold">{PACKS[slug].name}</span>
                  <span className="text-haze">{PACKS[slug].blurb}</span>
                </span>
                <span className="shrink-0 rounded-md bg-glacier px-4 py-2 font-semibold text-night group-hover:bg-ink">
                  Play today
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mt-12">
        <h2 id="how" className="font-sign text-2xl font-bold">
          How to play
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-haze marker:font-sign marker:text-ink">
          <li>Each question appears when you reach it, and its 30-second clock starts straight away.</li>
          <li>Type an answer and press Enter. Wrong? Keep guessing until you get one right or the clock runs out (up to 10 tries). Small spelling mistakes are fine.</li>
          <li>Every correct answer scores. The less expected it is for that question, the more it&apos;s worth.</li>
          <li>One game per pack per day: play Geography and Cricket separately. New questions every midnight UTC.</li>
        </ol>
      </section>

      <section aria-labelledby="scoring" className="mt-12">
        <h2 id="scoring" className="font-sign text-2xl font-bold">
          How rare answers score
        </h2>
        <div className="mt-4">
          <ElevationLadder />
        </div>
      </section>
    </main>
  );
}
