export const dynamic = "force-dynamic";

import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { displayNames } from "@/lib/admin/names";
import { STALE_SESSION_MINUTES } from "@/lib/services/session-cleanup";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { SheetTable, StatusTag, UserLink, fmtDateTime } from "@/components/admin/admin-ui";
import { ActionForm } from "@/components/admin/action-form";
import { expireStuckAction } from "./actions";

export const metadata = { title: "AI Coach sessions" };

const FILTERS = ["all", "stuck", "done", "error", "extracting", "extracted", "analyzing"] as const;
type Filter = (typeof FILTERS)[number];
const UUID = /^[0-9a-f-]{36}$/i;

/** Sessions last touched before this (ms) and still working are stuck. */
function staleCutoff(): number {
  return Date.now() - STALE_SESSION_MINUTES * 60_000;
}

interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  frame_count: number | null;
  overall_score: number | null;
  coins_charged: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<{ status?: string; user?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "all";
  const user = sp.user && UUID.test(sp.user) ? sp.user : undefined;
  const page = parsePage(sp.page);
  const staleBefore = staleCutoff();

  let query = adminClient()
    .from("run_sessions")
    .select("id, user_id, title, status, frame_count, overall_score, coins_charged, error, created_at, updated_at", { count: "exact" });
  if (filter === "stuck") {
    query = query.in("status", ["extracting", "analyzing"]).lt("updated_at", new Date(staleBefore).toISOString());
  } else if (filter !== "all") {
    query = query.eq("status", filter);
  }
  if (user) query = query.eq("user_id", user);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(...pageRange(page));
  if (error) throw new Error(`[admin] sessions failed: ${error.message}`);
  const sessions = (data ?? []) as SessionRow[];
  const names = await displayNames(sessions.map((s) => s.user_id));
  const total = count ?? 0;
  const href = (p: number, f: Filter = filter) => adminHref("/admin/sessions", { status: f === "all" ? undefined : f, user, page: p });

  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="AI Coach"
        aside={user ? <>Sessions of <UserLink id={user} name={names.get(user)} /></> : `${total.toLocaleString()} sessions`}
      >
        <FilterRow label="Status">
          {FILTERS.map((f) => (
            <FilterLink key={f} href={href(1, f)} active={f === filter}>{f}</FilterLink>
          ))}
        </FilterRow>
      </PageHeader>

      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Sessions idle for {STALE_SESSION_MINUTES} min while extracting or analyzing count as stuck. They expire (with a
        coin refund) the next time their owner opens the AI Coach, or now with Expire.
      </p>

      {sessions.length === 0 ? (
        <EmptyState>No sessions here.</EmptyState>
      ) : (
        <SheetTable head={["Started", "User", "Title", "Status", "Frames", "Score", "Coins", "Updated", ""]}>
          {sessions.map((s) => {
            const stuck = (s.status === "extracting" || s.status === "analyzing") && Date.parse(s.updated_at) < staleBefore;
            return (
              <tr key={s.id}>
                <td className="time text-xs whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                <td className="whitespace-nowrap"><UserLink id={s.user_id} name={names.get(s.user_id)} /></td>
                <td className="text-xs max-w-[16rem]">
                  {s.title}
                  {s.error && <p className="text-destructive mt-0.5">{s.error}</p>}
                </td>
                <td><StatusTag status={stuck ? "stuck" : s.status} /></td>
                <td className="time">{s.frame_count ?? 0}</td>
                <td className="time">{s.overall_score ?? "—"}</td>
                <td className="time">{s.coins_charged || "—"}</td>
                <td className="time text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(s.updated_at)}</td>
                <td>
                  {stuck && (
                    <ActionForm action={expireStuckAction} label="Expire" tone="danger">
                      <input type="hidden" name="user_id" value={s.user_id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </SheetTable>
      )}

      <div className="mt-4">
        <Pagination page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} href={(p) => href(p)} />
      </div>
    </div>
  );
}
