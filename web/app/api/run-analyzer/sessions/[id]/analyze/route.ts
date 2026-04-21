import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import {
  getSession,
  updateSession,
  getSessionFrames,
  getFramePublicUrl,
} from "@/lib/run-analyzer-db";

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

  await updateSession(id, { status: "analyzing" });

  // Get frames from DB
  const { data: frames } = await getSessionFrames(id);
  if (!frames || frames.length === 0) {
    await updateSession(id, { status: "error", error: "No frames found" });
    return NextResponse.json({ error: "No frames found" }, { status: 400 });
  }

  // Only send key frames to the analyzer (motion frames are for playback only)
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

  let analysis;
  try {
    const res = await fetch(`${EXTRACTOR_URL}/api/analyze-frames`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
      throw new Error(err.detail);
    }
    analysis = await res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis service error";
    await updateSession(id, { status: "error", error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await updateSession(id, {
    status: "done",
    analysis,
    overall_score: analysis.overall_score ?? null,
  });

  return NextResponse.json(analysis);
}
