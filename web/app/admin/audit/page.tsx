export const dynamic = "force-dynamic";

import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { displayNames } from "@/lib/admin/names";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { AUDIT_COLUMNS, AuditTable, type AuditRow } from "@/components/admin/audit-table";

export const metadata = { title: "Audit log" };

/** Event-type prefixes the log can be narrowed to. */
const GROUPS = { all: "all", admin: "admin actions", claim: "claims", dispute: "disputes", email: "emails", strava: "strava" } as const;
type Group = keyof typeof GROUPS;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ type?: string; user?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const group: Group = sp.type && sp.type in GROUPS ? (sp.type as Group) : "all";
  const user = sp.user && UUID.test(sp.user) ? sp.user : undefined;
  const page = parsePage(sp.page);

  let query = adminClient().from("claim_audit_log").select(AUDIT_COLUMNS, { count: "exact" });
  if (group !== "all") query = query.like("event_type", `${group}%`);
  if (user) query = query.eq("user_id", user);
  const { data, count, error } = await query.order("id", { ascending: false }).range(...pageRange(page));
  if (error) throw new Error(`[admin] audit failed: ${error.message}`);
  const rows = (data ?? []) as AuditRow[];
  const names = await displayNames(rows.map((r) => r.user_id));
  const total = count ?? 0;
  const href = (p: number, g: Group = group) => adminHref("/admin/audit", { type: g === "all" ? undefined : g, user, page: p });

  return (
    <div>
      <PageHeader kicker="Admin" title="Audit log" aside={`${total.toLocaleString()} entries`}>
        <FilterRow label="Type">
          {(Object.keys(GROUPS) as Group[]).map((g) => (
            <FilterLink key={g} href={href(1, g)} active={g === group}>{GROUPS[g]}</FilterLink>
          ))}
        </FilterRow>
      </PageHeader>
      {rows.length === 0 ? <EmptyState>No entries.</EmptyState> : <AuditTable rows={rows} names={names} />}
      <div className="mt-4">
        <Pagination page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} href={(p) => href(p)} />
      </div>
    </div>
  );
}
