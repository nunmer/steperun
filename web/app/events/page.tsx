import Link from "next/link";
import { getEvents, getEventYears } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Events" };
export const revalidate = 3600;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : undefined;

  const [events, years] = await Promise.all([getEvents(year), getEventYears()]);

  const byYear = events.reduce<Record<number, typeof events>>((acc, e) => {
    const y = e.year ?? 0;
    (acc[y] ??= []).push(e);
    return acc;
  }, {});
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground">{events.length} events</p>
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
        {sortedYears.map((y) => (
          <section key={y}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {y}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byYear[y].map((event) => (
                <Link key={event.slug} href={`/events/${event.slug}`} className="block">
                  <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-medium leading-snug">
                        {event.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <Badge variant="secondary">
                        {event.total_results.toLocaleString()} finishers
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
