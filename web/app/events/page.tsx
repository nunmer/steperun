import { getTranslations } from "next-intl/server";
import { getEvents, getEventYears } from "@/lib/queries";
import { groupByYear } from "@/lib/events";
import { parseIntInRange } from "@/lib/params";
import { EventYearGroups } from "@/components/event-list";
import { FilterLink, FilterRow, PageHeader } from "@/components/sheet";

export async function generateMetadata() {
  const t = await getTranslations("events.list");
  return { title: t("title") };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const t = await getTranslations("events.list");
  const { year: yearParam } = await searchParams;
  const year = parseIntInRange(yearParam, 2000, 2100);

  const [events, years] = await Promise.all([getEvents(year), getEventYears()]);
  const groups = groupByYear(events);
  const finishers = events.reduce((sum, e) => sum + e.total_results, 0);

  return (
    <div>
      <PageHeader
        title={t("title")}
        aside={
          <span className="time">
            {t("summary", { races: events.length, finishers })}
          </span>
        }
      />

      <div className="mb-8">
        <FilterRow label={t("season")}>
          <FilterLink href="/events" active={!year}>{t("all")}</FilterLink>
          {years.map((y) => (
            <FilterLink key={y} href={`/events?year=${y}`} active={year === y}>
              {y}
            </FilterLink>
          ))}
        </FilterRow>
      </div>

      <EventYearGroups groups={groups} />
    </div>
  );
}
