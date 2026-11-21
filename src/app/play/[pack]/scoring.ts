import type { AnswerResult } from "@/lib/game";
import { WRONG_EMOJI, tierForShare, type Tier } from "@/lib/tiers";

export function tierOf(result: AnswerResult | null): Tier | null {
  return result?.correct && result.share != null ? tierForShare(result.share) : null;
}

export function pointsOf(result: AnswerResult | null): number {
  return tierOf(result)?.points ?? 0;
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
