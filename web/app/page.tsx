import Link from "next/link";
import { getStats, getEvents } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const revalidate = 3600;

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-4xl font-bold tabular-nums">{value.toLocaleString()}</p>
        <p className="text-muted-foreground mt-1 text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

export default async function HomePage() {
  const [stats, events] = await Promise.all([getStats(), getEvents()]);

  const byYear = events.reduce<Record<number, typeof events>>((acc, e) => {
    const y = e.year ?? 0;
    (acc[y] ??= []).push(e);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-8 text-center space-y-4">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Almaty Running
          <br />
          <span className="text-primary">Database</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every runner. Every race. Every finish line — from 2015 to today.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/rankings">View Rankings</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/runners">Find a Runner</Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Database at a glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard value={stats.runners} label="Unique runners" />
          <StatCard value={stats.events} label="Race events" />
          <StatCard value={stats.results} label="Finishes logged" />
        </div>
      </section>

      {/* Event timeline */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Race events</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/events">All events →</Link>
          </Button>
        </div>
        <div className="space-y-8">
          {years.slice(0, 4).map((year) => (
            <div key={year}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {year}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byYear[year].map((event) => (
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
