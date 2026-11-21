import { NextResponse } from "next/server";
import { handleError, jsonError, parseGameFields, readJson } from "@/lib/api";
import { startPrompt } from "@/lib/game";
import { ensurePlayerId } from "@/lib/player";

/** Opens the next question: returns its text and the time left on the server's clock. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError("Send JSON: { pack, date, promptId }", 400);
  const fields = parseGameFields(body);
  if (fields instanceof NextResponse) return fields;

  try {
    const playerId = await ensurePlayerId();
    return NextResponse.json(await startPrompt(playerId, fields.pack, fields.date, fields.promptId));
  } catch (e) {
    return handleError(e);
  }
}
