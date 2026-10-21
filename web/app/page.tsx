import Link from "next/link";
import { getStats, getEvents } from "@/lib/queries";
import { groupByYear } from "@/lib/events";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event-card";
import { PhotoCarousel } from "@/components/photo-carousel";
import { carouselPhotos } from "@/lib/carousel-photos";

export const revalidate = 3600;

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-4xl font-bold tabular-nums text-[#22c55e]">{value.toLocaleString()}</p>
        <p className="text-muted-foreground mt-1 text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

export default async function HomePage() {
  const [stats, events] = await Promise.all([getStats(), getEvents()]);

  const groups = groupByYear(events).filter((g) => g.label !== "Other").slice(0, 4);
  const firstYear = events.reduce((min, e) => (e.year && e.year < min ? e.year : min), Infinity);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-8 text-center space-y-4">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Runners
          <br />
          <span className="text-primary">Database</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every runner. Every race. Every finish line
          {Number.isFinite(firstYear) ? ` — from ${firstYear} to today.` : "."}
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

      {/* Photo carousel */}
      {carouselPhotos.length > 0 && (
        <section>
          <PhotoCarousel photos={carouselPhotos} />
        </section>
      )}

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
          {groups.map(({ label, events: list }) => (
            <div key={label}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {label}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
