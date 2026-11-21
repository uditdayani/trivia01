import type { AnswerResult } from "@/lib/game";
import { WRONG_EMOJI, tierByName, type Tier } from "@/lib/tiers";

export function tierOf(result: AnswerResult | null): Tier | null {
  return result?.correct ? tierByName(result.tier) : null;
}

export function pointsOf(result: AnswerResult | null): number {
  return result?.correct ? result.points : 0;
}

export function emojiOf(result: AnswerResult | null): string {
  return tierOf(result)?.emoji ?? WRONG_EMOJI;
}

export function formatDate(iso: string, style: "long" | "short" = "long") {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    timeZone: "UTC",
  });
}

/** "1 of 4 players who got it right today gave this answer" */
export function statLine(result: AnswerResult | null): string | null {
  if (!result?.correct || result.nAnswer == null || result.nCorrect == null) return null;
  if (result.nCorrect <= 1) return "You're the first to give a correct answer today.";
  if (result.nAnswer <= 1) return `Nobody else gave it among ${result.nCorrect} correct answers so far today.`;
  return `${result.nAnswer} of ${result.nCorrect} correct answers today were this one.`;
}
