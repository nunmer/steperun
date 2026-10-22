export const dynamic = "force-dynamic";

import Link from "next/link";
import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { SearchBox, SheetTable, fmtDate, fmtDateTime } from "@/components/admin/admin-ui";

export const metadata = { title: "Events" };

const FILTERS = { all: "all", "no-date": "no date", "not-scraped": "not imported", empty: "no results" } as const;
type Filter = keyof typeof FILTERS;

interface EventRow {
  id: number;
  slug: string;
  name: string;
  year: number | null;
  date_of_event: string | null;
  scraped_at: string | null;
  total_results: number | null;
  organizer: string | null;
}

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const filter: Filter = sp.filter && sp.filter in FILTERS ? (sp.filter as Filter) : "all";
  const page = parsePage(sp.page);

  let query = adminClient()
    .from("events")
    .select("id, slug, name, year, date_of_event, scraped_at, total_results, organizer", { count: "exact" });
  if (q) {
    // Characters that would break PostgREST's or() syntax are dropped.
    const term = q.replace(/[,()"\\%*]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }
  if (filter === "no-date") query = query.is("date_of_event", null);
  if (filter === "not-scraped") query = query.is("scraped_at", null);
  if (filter === "empty") query = query.or("total_results.is.null,total_results.eq.0");
  const { data, count, error } = await query
    .order("date_of_event", { ascending: false, nullsFirst: true })
    .order("id", { ascending: false })
    .range(...pageRange(page));
  if (error) throw new Error(`[admin] events failed: ${error.message}`);
  const events = (data ?? []) as EventRow[];
  const total = count ?? 0;
  const href = (p: number, f: Filter = filter) => adminHref("/admin/events", { q, filter: f === "all" ? undefined : f, page: p });

  return (
    <div>
      <PageHeader kicker="Admin" title="Events" aside={`${total.toLocaleString()} events`}>
        <FilterRow label="Show">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <FilterLink key={f} href={href(1, f)} active={f === filter}>{FILTERS[f]}</FilterLink>
          ))}
        </FilterRow>
      </PageHeader>

      <SearchBox q={q} placeholder="Event name or slug" hidden={{ filter: filter === "all" ? undefined : filter }} />

      {events.length === 0 ? (
        <EmptyState>No events match.</EmptyState>
      ) : (
        <SheetTable head={["Date", "Event", "Organizer", "Results", "Imported"]}>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="time text-xs whitespace-nowrap">{e.date_of_event ? fmtDate(e.date_of_event) : e.year ?? "—"}</td>
              <td>
                <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">{e.name}</Link>
                <p className="time text-[11px] text-muted-foreground">{e.slug}</p>
              </td>
              <td className="text-xs">{e.organizer ?? "—"}</td>
              <td className="time">{(e.total_results ?? 0).toLocaleString()}</td>
              <td className="time text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(e.scraped_at)}</td>
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
