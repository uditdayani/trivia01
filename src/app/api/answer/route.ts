import { NextResponse } from "next/server";
import { GameError, getTodaysPrompts, isPackSlug, matchAnswer } from "@/lib/game";

const MAX_INPUT = 80;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON: { pack, promptId, input }" }, { status: 400 });
  }

  const { pack, promptId, input } = (body ?? {}) as Record<string, unknown>;
  if (typeof pack !== "string" || !isPackSlug(pack)) {
    return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
  }
  if (typeof promptId !== "number" || !Number.isInteger(promptId)) {
    return NextResponse.json({ error: "promptId must be a whole number." }, { status: 400 });
  }
  if (typeof input !== "string" || input.length > MAX_INPUT) {
    return NextResponse.json({ error: `Answers are text of up to ${MAX_INPUT} characters.` }, { status: 400 });
  }

  try {
    // Only today's prompts can be answered, so the API can't be used to probe the whole bank.
    const today = await getTodaysPrompts(pack);
    if (!today.some((p) => p.id === promptId)) {
      return NextResponse.json({ error: "That question isn't in today's puzzle." }, { status: 404 });
    }
    const result = await matchAnswer(promptId, input);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof GameError ? e.message : "Couldn't check that answer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
