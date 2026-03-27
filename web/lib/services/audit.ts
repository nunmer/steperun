import { createClient } from "@supabase/supabase-js";

// Uses service key — writes bypass RLS (intentional: audit log is append-only)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export interface AuditEntry {
  event_type: string;
  user_id?:   string;
  runner_id?: number;
  claim_id?:  number;
  ip_address?: string;
  payload?:   Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { error } = await adminClient()
    .from("claim_audit_log")
    .insert({
      event_type: entry.event_type,
      user_id:    entry.user_id ?? null,
      runner_id:  entry.runner_id ?? null,
      claim_id:   entry.claim_id ?? null,
      ip_address: entry.ip_address ?? null,
      payload:    entry.payload ?? null,
    });
  if (error) {
    // Non-fatal — don't let audit failure block the main flow
    console.error("[audit] Failed to write audit log:", error.message);
  }
}
