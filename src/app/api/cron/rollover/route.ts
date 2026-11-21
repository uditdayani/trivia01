import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Daily job (vercel.json): keeps 30 days of puzzles scheduled and marks past days final.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else is refused.
 * Safe to run more than once a day: it only fills gaps.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase isn't configured." }, { status: 500 });

  const { data, error } = await supabase.rpc("rollover", { p_days: 30 });
  if (error) {
    console.error("rollover failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log("rollover", data);
  return NextResponse.json(data);
}
