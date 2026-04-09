import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { getSession, getSessionFrames, getFramePublicUrl, type RunFrame } from "@/lib/run-analyzer-db";

/** GET /api/run-analyzer/sessions/[id] — full session with frames */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: session, error } = await getSession(id, user.id);
  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: frames } = await getSessionFrames(id);

  const framesWithUrls = ((frames ?? []) as RunFrame[]).map((f) => ({
    ...f,
    image_url: getFramePublicUrl(f.image_path),
  }));

  return NextResponse.json({ session, frames: framesWithUrls });
}
