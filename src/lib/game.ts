import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";

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

/** A game started just before midnight UTC can be finished just after it. */
export function isPlayableDate(date: string, now = new Date()): boolean {
  const today = puzzleDate(now);
  const yesterday = puzzleDate(new Date(now.getTime() - 86_400_000));
  return date === today || date === yesterday;
}

export type RowStatus = "unseen" | "in_progress" | "expired" | "answered" | "late";

export type AnswerResult = {
  input: string;
  name: string | null;
  correct: boolean;
  share: number | null;
  /** players who gave a correct answer to this question so far */
  nCorrect: number | null;
};

export type DayRow = {
  promptId: number;
  timeLimitS: number;
  status: RowStatus;
  text: string | null;
  result: AnswerResult | null;
  topAnswers?: { name: string; n: number }[];
};

export const DONE: RowStatus[] = ["expired", "answered", "late"];

export class GameError extends Error {
  constructor(
    message: string,
    public readonly httpStatus = 500,
  ) {
    super(message);
  }
}

function db() {
  const supabase = getServerSupabase();
  if (!supabase) throw new GameError("Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  return supabase;
}

const DB_ERRORS: Record<string, [string, number]> = {
  P0002: ["You've already finished today's puzzle.", 409],
  P0003: ["Answer the current question first.", 409],
  P0004: ["That question hasn't been opened yet.", 409],
};

function fail(error: { code?: string; message: string }): never {
  const known = error.code ? DB_ERRORS[error.code] : undefined;
  if (known) throw new GameError(known[0], known[1]);
  throw new GameError(error.message);
}

type DbDayRow = {
  ord: number;
  prompt_id: number;
  time_limit_s: number;
  status: RowStatus;
  prompt_text: string | null;
  remaining_ms: number | null;
  raw_input: string | null;
  canonical_name: string | null;
  is_correct: boolean;
  share: number | null;
  n_answer: number | null;
  n_correct: number | null;
};

/** The puzzle's questions for a player. Without a player, every question is unseen. */
export async function getDay(pack: PackSlug, date: string, playerId: string | null): Promise<DayRow[]> {
  if (!playerId) {
    const { data, error } = await db().rpc("todays_prompts", { p_pack_slug: pack, p_date: date });
    if (error) fail(error);
    return (data as { id: number; time_limit_s: number }[]).map((r) => ({
      promptId: Number(r.id),
      timeLimitS: r.time_limit_s,
      status: "unseen",
      text: null,
      result: null,
    }));
  }
  const { data, error } = await db().rpc("player_day", { p_player_id: playerId, p_pack_slug: pack, p_date: date });
  if (error) fail(error);
  return (data as DbDayRow[]).map((r) => ({
    promptId: Number(r.prompt_id),
    timeLimitS: r.time_limit_s,
    status: r.status,
    text: r.prompt_text,
    result:
      r.status === "answered" || r.status === "late"
        ? {
            input: r.raw_input ?? "",
            name: r.canonical_name,
            correct: r.is_correct,
            share: r.share,
            nCorrect: r.n_correct,
          }
        : null,
  }));
}

export async function withTopAnswers(rows: DayRow[], date: string): Promise<DayRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { data, error } = await db().rpc("top_answers", { p_prompt_id: row.promptId, p_date: date, p_limit: 3 });
      if (error) fail(error);
      return { ...row, topAnswers: (data as { canonical_name: string; n: number }[]).map((t) => ({ name: t.canonical_name, n: t.n })) };
    }),
  );
}

export async function startPrompt(playerId: string, pack: PackSlug, date: string, promptId: number) {
  const { data, error } = await db().rpc("start_prompt", {
    p_player_id: playerId,
    p_pack_slug: pack,
    p_date: date,
    p_prompt_id: promptId,
  });
  if (error) fail(error);
  const row = (data as { prompt_text: string; time_limit_s: number; remaining_ms: number }[])[0];
  return { text: row.prompt_text, timeLimitS: row.time_limit_s, remainingMs: row.remaining_ms };
}

export type SubmitResult = AnswerResult & { status: "answered" | "late" | "duplicate" };

export async function submitAnswer(playerId: string, date: string, promptId: number, input: string): Promise<SubmitResult> {
  const { data, error } = await db().rpc("submit_answer", {
    p_player_id: playerId,
    p_date: date,
    p_prompt_id: promptId,
    p_input: input,
  });
  if (error) fail(error);
  const r = (data as { status: SubmitResult["status"]; canonical_name: string | null; is_correct: boolean; share: number | null; n_correct: number | null }[])[0];
  return { status: r.status, input, name: r.canonical_name, correct: r.is_correct, share: r.share, nCorrect: r.n_correct };
}
