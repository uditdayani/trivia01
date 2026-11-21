import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";

export type PuzzlePrompt = {
  id: number;
  text: string;
  timeLimitS: number;
  theme: string;
};

export type MatchResult =
  | { status: "correct"; name: string }
  | { status: "wrong-entity"; name: string }
  | { status: "unrecognised" };

export const PACKS = {
  geography: { name: "Geography", live: true },
  cricket: { name: "Cricket", live: false },
} as const;

export type PackSlug = keyof typeof PACKS;

export function isPackSlug(s: string): s is PackSlug {
  return s in PACKS;
}

/** Puzzle date in UTC, so everyone everywhere shares one puzzle per day. */
export function puzzleDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export class GameError extends Error {}

function db() {
  const supabase = getServerSupabase();
  if (!supabase) throw new GameError("Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  return supabase;
}

export async function getTodaysPrompts(pack: PackSlug, date = puzzleDate()): Promise<PuzzlePrompt[]> {
  const { data, error } = await db().rpc("todays_prompts", { p_pack_slug: pack, p_date: date });
  if (error) throw new GameError(error.message);
  return (data as { id: number; text: string; time_limit_s: number; theme: string }[]).map((r) => ({
    id: Number(r.id),
    text: r.text,
    timeLimitS: r.time_limit_s,
    theme: r.theme,
  }));
}

export async function matchAnswer(promptId: number, input: string): Promise<MatchResult> {
  const { data, error } = await db().rpc("match_answer", { p_prompt_id: promptId, p_input: input });
  if (error) throw new GameError(error.message);
  const row = (data as { canonical_name: string; is_correct: boolean }[] | null)?.[0];
  if (!row) return { status: "unrecognised" };
  return row.is_correct
    ? { status: "correct", name: row.canonical_name }
    : { status: "wrong-entity", name: row.canonical_name };
}
