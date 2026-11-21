import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key.
 * Never import this from a client component: the key bypasses row-level security.
 * Returns null when env vars are missing so pages can show a setup hint.
 */
export function getServerSupabase(): SupabaseClient | null {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!rawUrl || !key) return null;
  // Keep only the origin, so a pasted ".../rest/v1/" or trailing slash still works.
  const url = new URL(rawUrl).origin;
  return createClient(url, key, { auth: { persistSession: false } });
}
