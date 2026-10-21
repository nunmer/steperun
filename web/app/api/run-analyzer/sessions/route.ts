import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { getUserSessions, getUserSessionCount, createSession } from "@/lib/run-analyzer-db";
import { COIN_ECONOMY } from "@/lib/coins-config";
import { getBalance, getCompletedAnalysisCount } from "@/lib/services/coins";

// Soft cap on lifetime sessions per user (storage safeguard).
const MAX_SESSIONS_PER_USER = 100;

/** GET /api/run-analyzer/sessions — list user's sessions + quota info */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: sessions, error }, balance, completedCount] = await Promise.all([
    getUserSessions(user.id),
    getBalance(user.id),
    getCompletedAnalysisCount(user.id),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const freeRemaining = Math.max(0, COIN_ECONOMY.FREE_ANALYSES - completedCount);

  return NextResponse.json({
    sessions,
    quota: {
      balance,
      freeRemaining,
      freeTotal: COIN_ECONOMY.FREE_ANALYSES,
      analysisCost: COIN_ECONOMY.ANALYSIS_COST,
      completed: completedCount,
    },
  });
}

/** POST /api/run-analyzer/sessions — create new session */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count, error: countErr } = await getUserSessionCount(user.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  if ((count ?? 0) >= MAX_SESSIONS_PER_USER) {
    return NextResponse.json(
      { error: `Session limit reached (${MAX_SESSIONS_PER_USER}). Delete old sessions to free up space.` },
      { status: 403 },
    );
  }

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { data, error } = await createSession({
    user_id: user.id,
    title: body.title,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
