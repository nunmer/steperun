import Link from "next/link";
import { getEvents, getEventYears } from "@/lib/queries";
import { groupByYear } from "@/lib/events";
import { parseIntInRange } from "@/lib/params";
import { EventCard } from "@/components/event-card";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground text-sm">{events.length} events</p>
      </div>

      {/* Year filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/events"
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
            !year ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
          }`}
        >
          All years
        </Link>
        {years.map((y) => (
          <Link
            key={y}
            href={`/events?year=${y}`}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              year === y ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {/* Events grouped by year */}
      <div className="space-y-10">
        {groups.map(({ label, events: list }) => (
          <section key={label}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {label}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((event) => (
                <EventCard key={event.slug} event={event} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
