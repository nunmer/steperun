import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { attachEvidence } from "@/lib/services/claims";

const ALLOWED_KINDS = ["screenshot", "gpx", "strava_activity", "other"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const claimId = Number(id);

  let body: { kind: string; url: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!ALLOWED_KINDS.includes(body.kind)) {
    return NextResponse.json({ error: `kind must be one of: ${ALLOWED_KINDS.join(", ")}` }, { status: 400 });
  }
  if (!body.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    await attachEvidence(claimId, user.id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
