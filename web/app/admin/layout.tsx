import type { Metadata } from "next";
import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { STALE_SESSION_MINUTES } from "@/lib/services/session-cleanup";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin | Steppe RUN" },
  robots: { index: false, follow: false },
};

/** Things waiting for an admin, shown as counts in the section nav. */
async function queueCounts() {
  const db = adminClient();
  const cutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60_000).toISOString();
  const [claims, disputes, stuck] = await Promise.all([
    db.from("runner_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("run_sessions").select("id", { count: "exact", head: true })
      .in("status", ["extracting", "analyzing"]).lt("updated_at", cutoff),
  ]);
  return { claims: claims.count ?? 0, disputes: disputes.count ?? 0, stuck: stuck.count ?? 0 };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const counts = await queueCounts();

  return (
    <div>
      <AdminNav
        items={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/claims", label: "Claims", count: counts.claims },
          { href: "/admin/disputes", label: "Disputes", count: counts.disputes },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/runners", label: "Runners" },
          { href: "/admin/events", label: "Events" },
          { href: "/admin/sessions", label: "AI Coach", count: counts.stuck },
          { href: "/admin/audit", label: "Audit log" },
          { href: "/admin/emails", label: "Emails" },
        ]}
      />
      {children}
    </div>
  );
}
