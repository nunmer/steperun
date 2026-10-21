import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import {
  getSession,
  updateSession,
  getSessionFrames,
  getFramePublicUrl,
  transitionSessionStatus,
} from "@/lib/run-analyzer-db";
import { COIN_ECONOMY } from "@/lib/coins-config";
import { getQuotaUsedCount, refundCoins, spendCoins } from "@/lib/services/coins";

const EXTRACTOR_URL = process.env.RUN_ANALYZER_API_URL || "http://localhost:8000";

/** POST /api/run-analyzer/sessions/[id]/analyze — run LLM analysis */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: session } = await getSession(id, user.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "extracted") {
    return NextResponse.json(
      { error: `Cannot analyze session in "${session.status}" state` },
      { status: 400 },
    );
  }

  // Claim the session first: only one request can move extracted → analyzing,
  // so a double-click or second tab can never charge twice.
  const claimed = await transitionSessionStatus(id, user.id, "extracted", "analyzing");
  if (!claimed) {
    return NextResponse.json(
      { error: "This session is already being analyzed." },
      { status: 409 },
    );
  }

  // Quota / payment gate
  const quotaUsed = await getQuotaUsedCount(user.id, id);
  const requiresPayment = quotaUsed >= COIN_ECONOMY.FREE_ANALYSES;

  if (requiresPayment) {
    const spend = await spendCoins(user.id, COIN_ECONOMY.ANALYSIS_COST, "analysis_spent");
    if (!spend.ok) {
      // Nothing was charged — release the session so the user can retry.
      await transitionSessionStatus(id, user.id, "analyzing", "extracted");
      if (spend.reason === "insufficient") {
        return NextResponse.json(
          {
            error: `Not enough coins. You have ${spend.balance}, need ${COIN_ECONOMY.ANALYSIS_COST}.`,
            code: "INSUFFICIENT_COINS",
            balance: spend.balance,
            cost: COIN_ECONOMY.ANALYSIS_COST,
          },
          { status: 402 },
        );
      }
      return NextResponse.json({ error: spend.message }, { status: 500 });
    }
  }

  const userId = user.id;

  /** Mark the session failed and give the coins back if this run was paid. */
  async function fail(message: string, status: number) {
    await updateSession(id, { status: "error", error: message });
    if (requiresPayment) {
      await refundCoins(userId, COIN_ECONOMY.ANALYSIS_COST);
    }
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const { data: frames } = await getSessionFrames(id);
    if (!frames || frames.length === 0) {
      return await fail("No frames found", 400);
    }

    const keyFrames = frames.filter((f: Record<string, unknown>) => f.is_key_frame !== false);
    console.log(`[analyze] Session ${id}: ${frames.length} total frames, ${keyFrames.length} key frames sent to LLM`);

    const form = new FormData();

    for (const f of keyFrames) {
      const url = getFramePublicUrl(f.image_path);
      const res = await fetch(url);
      if (!res.ok) continue;

      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "image/jpeg" });
      const filename = f.image_path.split("/").pop() || "frame.jpg";
      form.append("frames", blob, filename);
    }

    const res = await fetch(`${EXTRACTOR_URL}/api/analyze-frames`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
      return await fail(err.detail || "Analysis failed", 502);
    }
    const analysis = await res.json();

    await updateSession(id, {
      status: "done",
      analysis,
      overall_score: analysis.overall_score ?? null,
    });

    return NextResponse.json(analysis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis service error";
    console.error(`[analyze] Session ${id} failed`, e);
    return await fail(msg, 502);
  }
}
