import "server-only";
import { NextResponse } from "next/server";
import { GameError, isPackSlug, isPlayableDate, type PackSlug } from "@/lib/game";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof GameError) return jsonError(e.message, e.httpStatus);
  console.error(e);
  return jsonError("Something went wrong. Try again.", 500);
}

/** Validates the fields every game request carries. Returns an error response or the parsed values. */
export function parseGameFields(
  body: Record<string, unknown>,
): { pack: PackSlug; date: string; promptId: number } | NextResponse {
  const { pack, date, promptId } = body;
  if (typeof pack !== "string" || !isPackSlug(pack)) return jsonError("Unknown pack.", 400);
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isPlayableDate(date)) {
    return jsonError("That puzzle has closed. Reload for today's.", 410);
  }
  if (typeof promptId !== "number" || !Number.isInteger(promptId)) return jsonError("promptId must be a whole number.", 400);
  return { pack, date, promptId };
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
