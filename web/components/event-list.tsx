import Link from "next/link";
import type { EventRow } from "@/lib/queries";
import { OrganizerPin } from "@/components/organizer-pin";

/** "18 Oct" — the year is already the group heading. */
function shortDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Built by hand: en-GB says "Sept", which breaks the fixed-width date column.
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${String(d.getUTCDate()).padStart(2, "0")} ${month}`;
}

/** One race as a line in a results index: date · name · organizer · finishers. */
export function EventLine({ event }: { event: EventRow }) {
  const date = shortDate(event.date_of_event);
  return (
    <li>
      <Link
        href={`/events/${event.slug}`}
        className="group grid grid-cols-[3.75rem_1fr_auto] items-baseline gap-x-3 sm:gap-x-5 border-b py-3 hover:bg-muted/60 transition-colors"
      >
        <span className="time text-xs uppercase text-muted-foreground">{date ?? "—"}</span>
        <span className="min-w-0">
          <span className="block font-medium leading-snug group-hover:text-primary transition-colors">
            {event.name}
          </span>
          <OrganizerPin organizer={event.organizer} className="mt-0.5 sm:hidden" />
        </span>
        <span className="flex items-baseline gap-4 sm:gap-8">
          <OrganizerPin organizer={event.organizer} className="hidden sm:inline-flex w-36" />
          <span className="time text-sm text-right min-w-[4.5rem]">
            {event.total_results.toLocaleString()}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Events grouped by year. On wide screens the year sits in its own column
 * like an almanac margin; on phones it becomes a heading above its list.
 */
export function EventYearGroups({ groups }: { groups: { label: string; events: EventRow[] }[] }) {
  return (
    <div className="space-y-10">
      {groups.map(({ label, events }) => (
        <section key={label} className="grid lg:grid-cols-[9rem_1fr] gap-x-8">
          <h2 className="headline text-4xl lg:text-6xl text-muted-foreground/70 lg:sticky lg:top-20 lg:self-start border-b-2 border-rule lg:border-0 pb-2 lg:pb-0">
            {label}
          </h2>
          <div>
            <div className="hidden sm:grid grid-cols-[3.75rem_1fr_auto] gap-x-5 border-b border-rule pb-2 eyebrow lg:pt-3">
              <span>Date</span>
              <span>Race</span>
              <span className="flex gap-8">
                <span className="w-36">Organizer</span>
                <span className="min-w-[4.5rem] text-right">Finishers</span>
              </span>
            </div>
            <ul>
              {events.map((event) => (
                <EventLine key={event.slug} event={event} />
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
