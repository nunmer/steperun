import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { createClaim, checkRateLimit } from "@/lib/services/claims";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ipAddress = request.headers.get("x-forwarded-for") ?? "unknown";

  // Rate limit: 5 claims per hour per user
  const allowed = await checkRateLimit(user.id, ipAddress, "claim", 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded (5 claims/hour)" }, { status: 429 });
  }

  let body: { runner_id: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const runnerId = Number(body.runner_id);
  if (!runnerId || isNaN(runnerId)) {
    return NextResponse.json({ error: "runner_id is required" }, { status: 400 });
  }

  try {
    const result = await createClaim(user.id, runnerId, ipAddress);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("already has an active claim") || message.includes("already have")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
