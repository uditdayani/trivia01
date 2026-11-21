import { NextResponse } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { DONE, getDay, isPackSlug, isPlayableDate, withTopAnswers } from "@/lib/game";
import { readPlayerId } from "@/lib/player";

/** The player's finished day with live points and the most common answers. Only after all 7 are done. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pack = url.searchParams.get("pack") ?? "";
  const date = url.searchParams.get("date") ?? "";
  if (!isPackSlug(pack)) return jsonError("Unknown pack.", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isPlayableDate(date)) return jsonError("That puzzle has closed.", 410);

  const playerId = await readPlayerId();
  if (!playerId) return jsonError("Play the puzzle first.", 409);

  try {
    const rows = await getDay(pack, date, playerId);
    if (!rows.every((r) => DONE.includes(r.status))) return jsonError("Finish all the questions first.", 409);
    return NextResponse.json({ rows: await withTopAnswers(rows, date) });
  } catch (e) {
    return handleError(e);
  }
}
