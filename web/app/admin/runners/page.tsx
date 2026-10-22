export const dynamic = "force-dynamic";

import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, likeEscape, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { RUNNER_COLUMNS, type AdminRunner } from "@/lib/admin/runners";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { RunnerLink, SearchBox, SheetTable, UserLink, fmtDate } from "@/components/admin/admin-ui";

export const metadata = { title: "Runners" };

const FILTERS = { all: "all", claimed: "claimed", hidden: "hidden", "no-city": "no city" } as const;
type Filter = keyof typeof FILTERS;

export default async function AdminRunnersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const filter: Filter = sp.filter && sp.filter in FILTERS ? (sp.filter as Filter) : "all";
  const page = parsePage(sp.page);

  // Without a search or filter this would count every runner on each visit;
  // the list is only useful narrowed anyway.
  const narrowed = q !== "" || filter !== "all";
  let rows: AdminRunner[] = [];
  let total = 0;
  if (narrowed) {
    let query = adminClient().from("runners").select(RUNNER_COLUMNS, { count: "exact" });
    if (/^\d+$/.test(q)) query = query.eq("id", Number(q));
    else if (q) query = query.ilike("full_name", `%${likeEscape(q)}%`);
    if (filter === "claimed") query = query.not("claimed_by", "is", null);
    if (filter === "hidden") query = query.eq("is_hidden", true);
    if (filter === "no-city") query = query.is("city", null);
    const { data, count, error } = await query.order("full_name").order("id").range(...pageRange(page));
    if (error) throw new Error(`[admin] runners failed: ${error.message}`);
    rows = (data ?? []) as AdminRunner[];
    total = count ?? 0;
  }
  const href = (p: number, f: Filter = filter) => adminHref("/admin/runners", { q, filter: f === "all" ? undefined : f, page: p });

  return (
    <div>
      <PageHeader kicker="Admin" title="Runners" aside={narrowed ? `${total.toLocaleString()} found` : "Search by name or id"}>
        <FilterRow label="Show">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <FilterLink key={f} href={href(1, f)} active={f === filter}>{FILTERS[f]}</FilterLink>
          ))}
        </FilterRow>
      </PageHeader>

      <SearchBox q={q} placeholder="Name (any part) or runner id" hidden={{ filter: filter === "all" ? undefined : filter }} />

      {!narrowed ? (
        <EmptyState>Search for a runner to edit, hide, unclaim or merge duplicates.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No runners match.</EmptyState>
      ) : (
        <SheetTable head={["Id", "Name", "City", "Country", "ELO", "Owner", "Added", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className={r.is_hidden ? "text-muted-foreground" : undefined}>
              <td className="time text-xs">{r.id}</td>
              <td className="font-medium"><RunnerLink id={r.id} name={r.full_name} /></td>
              <td>{r.city ?? "—"}</td>
              <td>{r.country ?? "—"}</td>
              <td className="time">{r.elo_score ?? "—"}</td>
              <td>{r.claimed_by ? <UserLink id={r.claimed_by} name="owner" /> : "—"}</td>
              <td className="time text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
              <td className="time text-[10px]">{r.is_hidden ? "HIDDEN" : ""}</td>
            </tr>
          ))}
        </SheetTable>
      )}

      <div className="mt-4">
        <Pagination page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} href={(p) => href(p)} />
      </div>
    </div>
  );
}
