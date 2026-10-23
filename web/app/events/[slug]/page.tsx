import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getEvent, getEventResults, getEventStats, PAGE_SIZE } from "@/lib/queries";
import { parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Breakdown } from "@/components/breakdown";
import { OrganizerPin } from "@/components/organizer-pin";
import { BackLink, EmptyState, FilterLink, FilterRow, PageHeader, Place, Rank } from "@/components/sheet";
import { formatEventDate, formatNumber } from "@/lib/utils";

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
  const [t, tList, locale] = await Promise.all([getTranslations("events.event"), getTranslations("events.list"), getLocale()]);
  const num = (n: number) => formatNumber(n, locale);

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
  const multi = categories.length > 1;

  function hrefWithParams(overrides: { category?: string; page?: string }) {
    const merged = { category, page: String(page), ...overrides };
    return buildHref(`/events/${slug}`, { category: merged.category, page: merged.page });
  }

  return (
    <div>
      <PageHeader
        kicker={<BackLink href="/events">{tList("title")}</BackLink>}
        title={event.name}
        aside={<span className="time">{formatEventDate(event.date_of_event, locale) ?? event.year}</span>}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="time font-semibold">{num(event.total_results)}</span>{" "}
            <span className="text-muted-foreground">{t("finishers", { count: event.total_results })}</span>
          </span>
          {categories.length > 0 && (
            <span>
              <span className="time font-semibold">{categories.length}</span>{" "}
              <span className="text-muted-foreground">{t("distances", { count: categories.length })}</span>
            </span>
          )}
          <OrganizerPin organizer={event.organizer} />
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("official")}
            </a>
          )}
        </div>
      </PageHeader>

      {/* Who ran: the field broken down by distance, country and city. */}
      {(stats.distances.length > 0 || stats.countries.length > 0 || stats.cities.length > 0) && (
        <section aria-label={t("field")} className="grid gap-8 sm:grid-cols-3 mb-10">
          <Breakdown title={t("distance")} data={stats.distances} />
          <Breakdown title={t("city")} data={stats.cities} />
          <Breakdown title={t("country")} data={stats.countries} />
        </section>
      )}

      {multi && (
        <FilterRow label={t("distance")}>
          <FilterLink href={hrefWithParams({ category: undefined, page: "1" })} active={!category}>{t("all")}</FilterLink>
          {categories.map((cat) => (
            <FilterLink key={cat} href={hrefWithParams({ category: cat, page: "1" })} active={category === cat}>
              {cat}
            </FilterLink>
          ))}
        </FilterRow>
      )}

      <p className="eyebrow mt-6 mb-2">
        {total === 0
          ? t("none")
          : t("range", { from: num((page - 1) * PAGE_SIZE + 1), to: num(Math.min(page * PAGE_SIZE, total)), total: num(total) })}
      </p>

      {rows.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{t("cols.place")}</TableHead>
              <TableHead>{t("cols.runner")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("cols.from")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("cols.bib")}</TableHead>
              {multi && <TableHead className="hidden sm:table-cell">{t("cols.distance")}</TableHead>}
              <TableHead className="text-right">{t("cols.chip")}</TableHead>
              <TableHead className="hidden sm:table-cell text-right">{t("cols.gun")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const runner = row.runners;
              return (
                <TableRow key={`${runner.id}-${row.distance_category}-${i}`}>
                  <TableCell><Rank n={row.place} /></TableCell>
                  <TableCell className="whitespace-normal">
                    <Link href={`/runners/${runner?.id}`} className="font-medium hover:text-primary">
                      {runner?.full_name}
                    </Link>
                    {multi && (
                      <span className="block sm:hidden text-xs text-muted-foreground">{row.distance_category}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    <Place city={runner?.city} country={runner?.country} />
                  </TableCell>
                  <TableCell className="time text-muted-foreground text-xs hidden lg:table-cell">{row.bib_number}</TableCell>
                  {multi && (
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{row.distance_category}</TableCell>
                  )}
                  <TableCell className="time text-right font-medium">{row.chip_time ?? "—"}</TableCell>
                  <TableCell className="time text-right text-muted-foreground hidden sm:table-cell">
                    {row.finish_time ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={totalPages}
          href={(p) => hrefWithParams({ page: String(p) })}
        />
      </div>
    </div>
  );
}
