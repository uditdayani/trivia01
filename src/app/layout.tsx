import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rare-Answer Trivia",
  description: "A daily trivia game where the rarest correct answers score the most.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
