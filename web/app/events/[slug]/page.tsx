import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEventResults, getEventCategories, getEventStats } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PieChart } from "@/components/pie-chart";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  return { title: event?.name ?? slug };
}

const PAGE_SIZE = 30;

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { category, page: pageParam } = await searchParams;
  const page = Number(pageParam ?? 1);

  const [event, categories, stats] = await Promise.all([
    getEvent(slug),
    getEventCategories(slug),
    getEventStats(slug),
  ]);

  if (!event) notFound();

  const { rows, total } = await getEventResults(slug, { category, page });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function hrefWithParams(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { category, page: String(page), ...overrides };
    if (merged.category) p.set("category", merged.category);
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `/events/${slug}${qs ? `?${qs}` : ""}`;
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{event.name}</h1>
            <p className="text-muted-foreground mt-1">
              {event.year} · {event.total_results.toLocaleString()} finishers
            </p>
          </div>
          <Badge variant="outline" className="text-sm shrink-0">
            {event.year}
          </Badge>
        </div>
      </div>

      {/* Stats charts */}
      {(stats.countries.length > 0 || stats.cities.length > 0 || stats.distances.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-2">
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
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{" "}
        {total.toLocaleString()} results
      </p>

      {/* Results table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Place</TableHead>
              <TableHead>Runner</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Bib</TableHead>
              {categories.length > 1 && <TableHead>Distance</TableHead>}
              <TableHead>Finish</TableHead>
              <TableHead>Chip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const runner = row.runners as any;
              return (
                <TableRow key={i} className="hover:bg-muted/50">
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
                  <TableCell className="text-muted-foreground text-sm">{runner?.country}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{runner?.city}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{row.bib_number}</TableCell>
                  {categories.length > 1 && (
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {row.distance_category}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="font-mono tabular-nums">{row.finish_time ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">
                    {row.chip_time ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" disabled={page <= 1}>
            <Link href={hrefWithParams({ page: String(page - 1) })}>← Previous</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="outline" disabled={page >= totalPages}>
            <Link href={hrefWithParams({ page: String(page + 1) })}>Next →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
