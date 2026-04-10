/**
 * Typed helpers for run_sessions and run_frames tables.
 * Uses the admin supabase client with explicit types to avoid
 * conflicts with the main Database type definition.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function db() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }
  return _client;
}

// ----- run_sessions -----

export interface RunSession {
  id: string;
  user_id: string;
  title: string;
  status: "extracting" | "extracted" | "analyzing" | "done" | "error";
  frame_count: number;
  analysis: unknown;
  overall_score: number | null;
  provider: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createSession(data: {
  user_id: string;
  title?: string;
  provider?: string;
}) {
  return db()
    .from("run_sessions")
    .insert({
      user_id: data.user_id,
      title: data.title || "Untitled session",
      provider: data.provider || "aws",
      status: "extracting",
    })
    .select("id, title, status, created_at")
    .single();
}

export async function getUserSessions(userId: string) {
  return db()
    .from("run_sessions")
    .select("id, title, status, frame_count, overall_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function getUserSessionCount(userId: string) {
  return db()
    .from("run_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
}

export async function getSession(id: string, userId: string) {
  return db()
    .from("run_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
}

export async function updateSession(id: string, data: Record<string, unknown>) {
  return db()
    .from("run_sessions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
}

// ----- run_frames -----

export interface RunFrame {
  id: string;
  session_id: string;
  idx: number;
  phase: string;
  frame_number: number;
  timestamp_ms: number;
  image_path: string;
  is_key_frame: boolean;
  landmarks: unknown;
  created_at: string;
}

export async function insertFrames(frames: Array<{
  session_id: string;
  idx: number;
  phase: string;
  frame_number: number;
  timestamp_ms: number;
  image_path: string;
  is_key_frame?: boolean;
}>) {
  return db().from("run_frames").insert(frames);
}

export async function getSessionFrames(sessionId: string) {
  return db()
    .from("run_frames")
    .select("*")
    .eq("session_id", sessionId)
    .order("idx");
}

// ----- Storage -----

export function getFramePublicUrl(path: string) {
  const { data } = db().storage.from("run-frames").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFrame(path: string, buffer: Buffer) {
  return db().storage
    .from("run-frames")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
}
