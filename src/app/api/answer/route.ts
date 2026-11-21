import { NextResponse } from "next/server";
import { handleError, jsonError, parseGameFields, readJson } from "@/lib/api";
import { submitAnswer } from "@/lib/game";
import { readPlayerId } from "@/lib/player";

const MAX_INPUT = 80;

/** Checks and saves an answer. The database enforces the timer and one answer per question. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError("Send JSON: { pack, date, promptId, input }", 400);
  const fields = parseGameFields(body);
  if (fields instanceof NextResponse) return fields;
  const { input } = body;
  if (typeof input !== "string" || input.length > MAX_INPUT) {
    return jsonError(`Answers are text of up to ${MAX_INPUT} characters.`, 400);
  }

  const playerId = await readPlayerId();
  if (!playerId) return jsonError("Open the question before answering it.", 409);

  try {
    return NextResponse.json(await submitAnswer(playerId, fields.date, fields.promptId, input.trim()));
  } catch (e) {
    return handleError(e);
  }
}
