import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { generateStravaState, stravaAuthUrl } from "@/lib/services/strava";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = generateStravaState(user.id);
  const url = stravaAuthUrl(state);
  return NextResponse.redirect(url);
}
