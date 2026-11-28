import Link from "next/link";
import { MountainRange, PeakLadder } from "@/components/mountains";
import { PACKS } from "@/lib/game";

const ROUTE = [
  "Each question appears when you reach it, and its 30-second clock starts straight away.",
  "Type an answer and press Enter. Wrong? Keep guessing until one's right or the clock runs out (10 tries at most). Small spelling slips are fine.",
  "Every correct answer scores. The less expected it is for that question, the higher it climbs.",
  "One climb per pack per day. New questions at midnight UTC.",
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* the range: sky, ridges and the headline, full width */}
      <section className="relative -mt-20 overflow-hidden pt-20">
        <MountainRange className="absolute inset-0 h-full w-full" />
        <div className="relative mx-auto max-w-2xl px-5 pb-40 pt-6 sm:pb-52 sm:pt-12">
          <h1 className="max-w-[12ch] font-sign text-6xl font-bold leading-[0.9] tracking-tight sm:text-8xl">
            Name what nobody else thinks of.
          </h1>
          <p className="mt-5 max-w-md text-lg text-haze">
            Seven questions a day. Obvious answers stay at base camp; the unexpected ones reach the summit.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-5">
        {/* trail signs on a post */}
        <section aria-labelledby="packs" className="relative -mt-16 pl-7 sm:-mt-24">
          <h2 id="packs" className="sr-only">
            Choose today&apos;s climb
          </h2>
          <span className="absolute bottom-[-2.5rem] left-2 top-0 w-2.5 rounded-sm bg-[#6f5b44]" aria-hidden="true" />
          <ul className="space-y-3">
            {(Object.keys(PACKS) as (keyof typeof PACKS)[]).map((slug) => (
              <li key={slug}>
                <Link
                  href={`/play/${slug}`}
                  className="trail-sign group flex items-center justify-between gap-4 bg-sign py-3 pl-5 pr-12 text-sign-ink transition-transform hover:translate-x-1.5 focus-visible:translate-x-1.5"
                >
                  <span>
                    <span className="block font-sign text-3xl font-bold leading-tight">{PACKS[slug].name}</span>
                    <span className="block text-sm font-medium opacity-75">{PACKS[slug].blurb}</span>
                  </span>
                  <span className="shrink-0 text-right font-sign text-lg font-semibold leading-tight">
                    7 questions
                    <span className="block text-sm font-medium opacity-75">about 4 min</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="route" className="mt-20">
          <h2 id="route" className="font-sign text-3xl font-bold">
            The route
          </h2>
          <ol className="relative mt-5 space-y-5 border-l-2 border-dashed border-rule pl-7">
            {ROUTE.map((step, i) => (
              <li key={i} className="relative">
                <span className="waymark absolute -left-[2.3rem] top-1 h-5 w-3 rounded-[2px]" aria-hidden="true" />
                <span className="font-sign text-lg font-semibold text-ink">Stage {i + 1}. </span>
                <span className="text-haze">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="summits" className="mt-20 pb-6">
          <h2 id="summits" className="font-sign text-3xl font-bold">
            Six summits
          </h2>
          <p className="mt-2 max-w-prose text-haze">
            Each answer&apos;s tier is set for that question before the day starts, so your points never change once
            you&apos;ve answered. The peaks are drawn to their real heights.
          </p>
          <div className="mt-6">
            <PeakLadder />
          </div>
        </section>
      </div>
    </main>
  );
}
