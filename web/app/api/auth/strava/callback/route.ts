import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase-server";
import { verifyStravaState, exchangeCode } from "@/lib/services/strava";
import { logAudit } from "@/lib/services/audit";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/profile?strava=denied", request.url));
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/api/auth/strava/connect", request.url));
  }

  if (!verifyStravaState(state, user.id)) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (err) {
    return NextResponse.json({ error: "Strava token exchange failed" }, { status: 502 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Upsert strava_tokens
  await db.from("strava_tokens").upsert({
    user_id:       user.id,
    athlete_id:    tokens.athlete.id,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at:    new Date(tokens.expires_at * 1000).toISOString(),
    scope:         "read,activity:read",
    connected_at:  new Date().toISOString(),
  }, { onConflict: "user_id" });

  // Credit trust score for connecting Strava
  const { data: profile } = await db
    .from("user_profiles")
    .select("trust_score")
    .eq("id", user.id)
    .single();
  const current = (profile as { trust_score?: number } | null)?.trust_score ?? 0;
  await db.from("user_profiles")
    .update({ trust_score: Math.min(100, current + 20) })
    .eq("id", user.id);

  await logAudit({
    event_type: "strava_connected",
    user_id:    user.id,
    ip_address: request.headers.get("x-forwarded-for") ?? undefined,
    payload:    { athlete_id: tokens.athlete.id },
  });

  return NextResponse.redirect(new URL("/profile?strava=connected", request.url));
}
