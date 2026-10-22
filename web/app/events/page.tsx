import { getEvents, getEventYears } from "@/lib/queries";
import { groupByYear } from "@/lib/events";
import { parseIntInRange } from "@/lib/params";
import { EventYearGroups } from "@/components/event-list";
import { FilterLink, FilterRow, PageHeader } from "@/components/sheet";

export const metadata = { title: "Events" };
export const revalidate = 86400;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = parseIntInRange(yearParam, 2000, 2100);

  const [events, years] = await Promise.all([getEvents(year), getEventYears()]);
  const groups = groupByYear(events);
  const finishers = events.reduce((sum, e) => sum + e.total_results, 0);

  return (
    <div>
      <PageHeader
        title="Events"
        aside={
          <span className="time">
            {events.length} races · {finishers.toLocaleString()} finishers
          </span>
        }
      />

      <div className="mb-8">
        <FilterRow label="Season">
          <FilterLink href="/events" active={!year}>All</FilterLink>
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
