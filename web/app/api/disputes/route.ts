import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { createDispute } from "@/lib/services/disputes";
import { checkRateLimit } from "@/lib/services/claims";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ipAddress = request.headers.get("x-forwarded-for") ?? "unknown";

  // Rate limit: 3 disputes per day per user
  const allowed = await checkRateLimit(user.id, ipAddress, "dispute", 3, 24 * 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded (3 disputes/day)" }, { status: 429 });
  }

  let body: { claim_id: number; reason: string; evidence?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.claim_id || !body.reason) {
    return NextResponse.json({ error: "claim_id and reason are required" }, { status: 400 });
  }

  try {
    const result = await createDispute(user.id, body.claim_id, body.reason, body.evidence ?? null, ipAddress);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
