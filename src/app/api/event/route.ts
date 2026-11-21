import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { isPackSlug, isPlayableDate } from "@/lib/game";
import { readPlayerId } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";

const NAMES = new Set(["puzzle_view", "game_start", "game_finish", "result_copy"]);

/** Records a named game event. Fire-and-forget from the browser; never blocks play. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError("Send JSON: { name, pack, date, props? }", 400);
  const { name, pack, date, props } = body;
  if (typeof name !== "string" || !NAMES.has(name)) return jsonError("Unknown event.", 400);
  if (typeof pack !== "string" || !isPackSlug(pack)) return jsonError("Unknown pack.", 400);
  if (typeof date !== "string" || !isPlayableDate(date)) return jsonError("Unknown date.", 400);

  const safeProps =
    props && typeof props === "object" && !Array.isArray(props) && JSON.stringify(props).length <= 500 ? props : {};

  const supabase = getServerSupabase();
  if (!supabase) return new NextResponse(null, { status: 204 });

  const playerId = await readPlayerId();
  const { data: packRow } = await supabase.from("packs").select("id").eq("slug", pack).maybeSingle();
  // players row may not exist yet (viewed but never started); store the id only if it does
  let player: string | null = null;
  if (playerId) {
    const { data } = await supabase.from("players").select("id").eq("id", playerId).maybeSingle();
    player = data?.id ?? null;
  }
  const { error } = await supabase.from("events").insert({
    name,
    player_id: player,
    pack_id: packRow?.id ?? null,
    puzzle_date: date,
    props: safeProps,
  });
  if (error) console.error("event insert failed", error.message);
  return new NextResponse(null, { status: 204 });
}
