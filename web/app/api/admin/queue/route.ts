import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Middleware already verified admin — this route is safe to call directly
export async function GET(_request: NextRequest) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await db
    .from("runner_claims")
    .select("id, runner_id, user_id, status, trust_score_at_claim, strava_match_score, created_at, runners(full_name), user_profiles(display_name)")
    .in("status", ["pending"])
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
