import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/services/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const claimId = Number(id);

  let body: { action: "approve" | "reject"; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: claim } = await db
    .from("runner_claims")
    .select("id, runner_id, user_id, status")
    .eq("id", claimId)
    .single();

  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (claim.status !== "pending") {
    return NextResponse.json({ error: "Claim is not pending" }, { status: 409 });
  }

  const newStatus = body.action === "approve" ? "approved" : "rejected";

  await db.from("runner_claims").update({
    status:       newStatus,
    reviewed_by:  user.id,
    reviewed_at:  new Date().toISOString(),
    review_notes: body.notes ?? null,
    updated_at:   new Date().toISOString(),
  }).eq("id", claimId);

  if (body.action === "approve") {
    await db.from("runners").update({ claimed_by: claim.user_id }).eq("id", claim.runner_id);
  }

  await logAudit({
    event_type: `admin_claim_${body.action}d`,
    user_id:    user.id,
    runner_id:  claim.runner_id,
    claim_id:   claimId,
    payload:    { notes: body.notes ?? null },
  });

  return NextResponse.json({ success: true, status: newStatus });
}
