import type { Metadata } from "next";
import Link from "next/link";
import { SummitMark } from "@/components/mountains";
import "@fontsource/commissioner/400";
import "@fontsource/commissioner/600";
import "@fontsource/commissioner/700";
import "@fontsource/big-shoulders-stencil-display/600";
import "@fontsource/big-shoulders-stencil-display/700";
import "@fontsource/big-shoulders-stencil-display/800";
import "./globals.css";

export const metadata: Metadata = {
  title: "TriviaSummit",
  description: "TriviaSummit: a daily trivia game where the least expected correct answers climb highest.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans text-[17px] leading-relaxed">
        <header className="relative z-10 mx-auto flex h-20 w-full max-w-2xl items-center px-5">
          <Link href="/" className="flex items-end gap-2 font-sign text-2xl font-bold tracking-tight text-ink">
            <SummitMark className="mb-1 h-6 w-8" />
            TriviaSummit
          </Link>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="mx-auto w-full max-w-2xl border-t border-rule px-5 py-8 text-sm text-haze">
          Country data from{" "}
          <a className="underline" href="https://github.com/mledoze/countries">
            mledoze/countries
          </a>
          , licensed under ODbL 1.0. Answer familiarity from{" "}
          <a className="underline" href="https://github.com/rspeer/wordfreq">
            wordfreq
          </a>{" "}
          (CC BY-SA 4.0). IPL match data from{" "}
          <a className="underline" href="https://cricsheet.org">
            Cricsheet
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
