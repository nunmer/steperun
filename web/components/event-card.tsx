import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import type { EventRow } from "@/lib/queries";
import { formatEventDate } from "@/lib/utils";
import { OrganizerPin } from "@/components/organizer-pin";
import { SeasonCard } from "@/components/season-card";

export function EventCard({ event }: { event: EventRow }) {
  const date = formatEventDate(event.date_of_event);
  return (
    <Link href={`/events/${event.slug}`} className="block h-full">
      <SeasonCard dateOfEvent={event.date_of_event}>
        <OrganizerPin organizer={event.organizer} className="self-start mb-3 mr-8" />
        <h3 className="font-semibold leading-snug line-clamp-2 mb-4">{event.name}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden />
              {date}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            <span className="tabular-nums">{event.total_results.toLocaleString()}</span> finishers
          </span>
        </div>
      </SeasonCard>
    </Link>
  );
}
