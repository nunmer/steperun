import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/services/admin";
import { AdminInputError } from "@/lib/admin/action";
import { approveClaim, rejectClaim } from "@/lib/admin/claims";

/** POST { action: "approve" | "reject", notes? } — same path as the /admin/claims buttons. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const claimId = Number((await params).id);
  if (!Number.isInteger(claimId) || claimId <= 0) {
    return NextResponse.json({ error: "Bad claim id" }, { status: 400 });
  }

  let body: { action?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  try {
    const decide = body.action === "approve" ? approveClaim : rejectClaim;
    const message = await decide(claimId, admin.id, notes);
    return NextResponse.json({ success: true, status: body.action === "approve" ? "approved" : "rejected", message });
  } catch (e) {
    if (e instanceof AdminInputError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[admin] decision failed", e);
    return NextResponse.json({ error: "Decision failed" }, { status: 500 });
  }
}
