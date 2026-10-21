import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEventResults, getEventStats, PAGE_SIZE } from "@/lib/queries";
import { parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PieChart } from "@/components/pie-chart";
import { OrganizerPin } from "@/components/organizer-pin";
import { formatEventDate } from "@/lib/utils";
import { CalendarDays, ExternalLink, Route, Users } from "lucide-react";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  return { title: event?.name ?? slug };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { category: categoryParam, page: pageParam } = await searchParams;

  const event = await getEvent(slug);
  if (!event) notFound();

  // Distances, counts and totals all come from the stats RPC (one aggregate),
  // so the filter lists every distance and pagination totals are exact.
  const stats = await getEventStats(event.id);
  const categories = stats.distances.map((d) => d.label);
  const category = categoryParam && categories.includes(categoryParam) ? categoryParam : undefined;
  const total = category
    ? stats.distances.find((d) => d.label === category)?.count ?? 0
    : stats.distances.reduce((sum, d) => sum + d.count, 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), totalPages);
  const rows = await getEventResults(event.id, category, page);

  function hrefWithParams(overrides: { category?: string; page?: string }) {
    const merged = { category, page: String(page), ...overrides };
    return buildHref(`/events/${slug}`, { category: merged.category, page: merged.page });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/events"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← All events
        </Link>
        <OrganizerPin organizer={event.organizer} className="mb-3" />
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{event.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {formatEventDate(event.date_of_event) ?? event.year}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            <span className="tabular-nums">{event.total_results.toLocaleString()}</span> finishers
          </span>
          {categories.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Route className="size-4" aria-hidden />
              {categories.length} {categories.length === 1 ? "distance" : "distances"}
            </span>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              Official results
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* Stats charts */}
      {(stats.countries.length > 0 || stats.cities.length > 0 || stats.distances.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-2">
          <PieChart title="Distance" data={stats.distances} maxSlices={6} />
          <PieChart title="Country" data={stats.countries} maxSlices={6} />
          <PieChart title="City" data={stats.cities} maxSlices={6} />
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={hrefWithParams({ category: undefined, page: "1" })}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              !category
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            All distances
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={hrefWithParams({ category: cat, page: "1" })}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                category === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "No finishers recorded."
          : `Showing ${((page - 1) * PAGE_SIZE + 1).toLocaleString()}–${Math.min(page * PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()} results`}
      </p>

      {/* Results table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Place</TableHead>
              <TableHead>Runner</TableHead>
              <TableHead className="hidden sm:table-cell">Country</TableHead>
              <TableHead className="hidden md:table-cell">City</TableHead>
              <TableHead className="hidden md:table-cell">Bib</TableHead>
              {categories.length > 1 && <TableHead>Distance</TableHead>}
              <TableHead>Finish</TableHead>
              <TableHead className="hidden sm:table-cell">Chip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const runner = row.runners;
              return (
                <TableRow key={`${runner.id}-${row.distance_category}-${i}`} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-muted-foreground text-sm">
                    {row.place ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/runners/${runner?.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {runner?.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{runner?.country}</TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{runner?.city}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono hidden md:table-cell">{row.bib_number}</TableCell>
                  {categories.length > 1 && (
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {row.distance_category}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="font-mono tabular-nums">{row.finish_time ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums text-muted-foreground hidden sm:table-cell">
                    {row.chip_time ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        href={(p) => hrefWithParams({ page: String(p) })}
      />
    </div>
  );
}
