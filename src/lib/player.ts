import "server-only";
import { cookies } from "next/headers";

const COOKIE = "rt_pid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The player's id from their cookie, or null if they haven't played yet. */
export async function readPlayerId(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value && UUID.test(value) ? value : null;
}

/** The player's id, creating one (and setting the cookie) if needed. Route handlers only. */
export async function ensurePlayerId(): Promise<string> {
  const existing = await readPlayerId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}
