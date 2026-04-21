import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import {
  getSession,
  updateSession,
  insertFrames,
  uploadFrame,
  getFramePublicUrl,
} from "@/lib/run-analyzer-db";

export const maxDuration = 120;

const EXTRACTOR_URL = process.env.RUN_ANALYZER_API_URL || "http://localhost:8000";

/** POST /api/run-analyzer/extract — upload video, extract frames via Python service */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const video = formData.get("video") as File | null;
  const sessionId = formData.get("session_id") as string | null;

  if (!video || !sessionId) {
    return NextResponse.json({ error: "video and session_id required" }, { status: 400 });
  }

  // Verify session belongs to user
  const { data: session } = await getSession(sessionId, user.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Forward video to Python extractor service
  const extractForm = new FormData();
  extractForm.append("video", video);

  let extractResult;
  try {
    const res = await fetch(`${EXTRACTOR_URL}/api/extract`, {
      method: "POST",
      body: extractForm,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Extraction service error" }));
      await updateSession(sessionId, { status: "error", error: err.detail });
      return NextResponse.json({ error: err.detail }, { status: res.status });
    }
    extractResult = await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extraction service unavailable";
    console.error("Extraction fetch error:", msg);
    await updateSession(sessionId, { status: "error", error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Store frames in Supabase Storage + DB
  const frames: Array<{
    session_id: string;
    idx: number;
    phase: string;
    frame_number: number;
    timestamp_ms: number;
    image_path: string;
    is_key_frame: boolean;
  }> = [];

  for (let i = 0; i < extractResult.frames.length; i++) {
    const f = extractResult.frames[i];
    const isKey = f.is_key_frame ?? true;

    // Only persist key frames. Motion frames stay in the response for
    // ephemeral playback but are not uploaded — keeps storage quota low.
    if (!isKey) continue;

    const base64 = f.src.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const storagePath = `${user.id}/${sessionId}/${String(i).padStart(3, "0")}_key_${f.phase}.jpg`;

    const { error: uploadErr } = await uploadFrame(storagePath, buffer);
    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      continue;
    }

    frames.push({
      session_id: sessionId,
      idx: i,
      phase: f.phase,
      frame_number: f.frame_number,
      timestamp_ms: f.timestamp_ms,
      image_path: storagePath,
      is_key_frame: isKey,
    });
  }

  if (frames.length > 0) {
    await insertFrames(frames);
  }

  await updateSession(sessionId, { status: "extracted", frame_count: frames.length });

  const framesWithUrls = frames.map((f) => ({
    ...f,
    image_url: getFramePublicUrl(f.image_path),
  }));

  return NextResponse.json({ session_id: sessionId, frames: framesWithUrls });
}
