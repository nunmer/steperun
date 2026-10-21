import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { getSession, createVideoUploadUrl, MAX_VIDEO_BYTES } from "@/lib/run-analyzer-db";

/** POST /api/run-analyzer/upload-url — signed URL for uploading a session video to Storage */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    session_id?: unknown;
    filename?: unknown;
    size?: unknown;
    type?: unknown;
  } | null;
  const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  const type = typeof body?.type === "string" ? body.type : "";

  if (!sessionId) return NextResponse.json({ error: "session_id required" }, { status: 400 });
  if (type && !type.startsWith("video/")) {
    return NextResponse.json({ error: "Please upload a video file" }, { status: 400 });
  }
  if (!(size > 0) || size > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: `Video must be under ${MAX_VIDEO_BYTES / 1024 / 1024} MB. Trim it to a few seconds of running.` },
      { status: 413 },
    );
  }

  const { data: session } = await getSession(sessionId, user.id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const ext = filename.match(/\.[a-z0-9]{1,5}$/i)?.[0].toLowerCase() ?? ".mp4";
  const path = `${user.id}/${sessionId}/video${ext}`;
  const { data, error } = await createVideoUploadUrl(path);
  if (error || !data) {
    console.error("Signed upload URL error:", error);
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }
  return NextResponse.json({ path: data.path, token: data.token });
}
