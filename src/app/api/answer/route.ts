import { NextResponse } from "next/server";
import { handleError, jsonError, parseGameFields, readJson } from "@/lib/api";
import { submitAnswer } from "@/lib/game";
import { readPlayerId } from "@/lib/player";

const MAX_INPUT = 80;

/**
 * Checks a guess. Wrong guesses come back as "retry" while time and guesses remain;
 * a correct guess, or any guess sent with final: true (clock ran out), ends the question.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError("Send JSON: { pack, date, promptId, input }", 400);
  const fields = parseGameFields(body);
  if (fields instanceof NextResponse) return fields;
  const { input, final } = body;
  if (typeof input !== "string" || input.length > MAX_INPUT) {
    return jsonError(`Answers are text of up to ${MAX_INPUT} characters.`, 400);
  }

  const playerId = await readPlayerId();
  if (!playerId) return jsonError("Open the question before answering it.", 409);

  try {
    return NextResponse.json(await submitAnswer(playerId, fields.date, fields.promptId, input.trim(), final === true));
  } catch (e) {
    return handleError(e);
  }
}
