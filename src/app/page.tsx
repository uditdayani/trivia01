import Link from "next/link";
import { ElevationLadder } from "@/components/elevation-ladder";
import { PACKS } from "@/lib/game";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-10 pt-10 sm:pt-16">
      <h1 className="font-sign text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
        Name what nobody else thinks of.
      </h1>
      <p className="mt-5 max-w-prose text-lg text-stone">
        Seven questions a day, thirty seconds each. Every correct answer scores, and the fewer players
        who gave the same one, the higher it climbs.
      </p>

      <section aria-labelledby="packs" className="mt-10">
        <h2 id="packs" className="sr-only">
          Choose a pack
        </h2>
        <ul className="divide-y divide-mist border-y border-mist">
          <li>
            <Link
              href="/play/geography"
              className="group flex items-baseline justify-between gap-4 py-5 hover:bg-glacier-soft/50"
            >
              <span>
                <span className="block font-sign text-3xl font-bold">{PACKS.geography.name}</span>
                <span className="text-stone">195 countries, a new set of questions every day</span>
              </span>
              <span className="shrink-0 rounded-md bg-slate px-4 py-2 font-medium text-snow group-hover:bg-glacier">
                Play today
              </span>
            </Link>
          </li>
          <li className="flex items-baseline justify-between gap-4 py-5 text-stone">
            <span>
              <span className="block font-sign text-3xl font-bold">{PACKS.cricket.name}</span>
              <span>Players, records and teams</span>
            </span>
            <span className="shrink-0 text-sm">Coming soon</span>
          </li>
        </ul>
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
