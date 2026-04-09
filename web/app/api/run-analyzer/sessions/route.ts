import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import {
  getUserSessions,
  getUserSessionCount,
  createSession,
} from "@/lib/run-analyzer-db";

const FREE_LIMIT = 2;

/** GET /api/run-analyzer/sessions — list user's sessions */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getUserSessions(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessions: data });
}

/** POST /api/run-analyzer/sessions — create new session (checks free limit) */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count, error: countErr } = await getUserSessionCount(user.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  if ((count ?? 0) >= FREE_LIMIT) {
    return NextResponse.json(
      { error: "Free limit reached (2 analyses). Upgrade coming soon!" },
      { status: 403 },
    );
  }

  let body: { title?: string; provider?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { data, error } = await createSession({
    user_id: user.id,
    title: body.title,
    provider: body.provider,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
