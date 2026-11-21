import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rare-Answer Trivia",
  description: "A daily trivia game where the rarest correct answers score the most.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans text-[17px] leading-relaxed">
        <header className="mx-auto w-full max-w-2xl px-5 pt-6">
          <Link href="/" className="font-sign text-xl font-bold tracking-tight text-slate">
            Rare-Answer Trivia
          </Link>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="mx-auto w-full max-w-2xl px-5 py-8 text-sm text-stone">
          Country data from{" "}
          <a className="underline" href="https://github.com/mledoze/countries">
            mledoze/countries
          </a>
          , licensed under ODbL 1.0. Answer familiarity from{" "}
          <a className="underline" href="https://github.com/rspeer/wordfreq">
            wordfreq
          </a>{" "}
          (CC BY-SA 4.0).
        </footer>
      </body>
    </html>
  );
}
