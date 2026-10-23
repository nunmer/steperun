import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { EventRow } from "@/lib/queries";
import { OrganizerPin } from "@/components/organizer-pin";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { formatNumber } from "@/lib/utils";

/** "18 Oct" / "18 окт" — the year is already the group heading. */
function shortDate(date: string | null, locale: Locale): string | null {
  if (!date) return null;
  // Three-letter months keep the fixed-width date column aligned.
  return formatDate(date.slice(0, 10), locale, { day: true, padDay: true, month: "short" });
}

/** One race as a line in a results index: date · name · organizer · finishers. */
export function EventLine({ event }: { event: EventRow }) {
  const locale = useLocale();
  const date = shortDate(event.date_of_event, locale);
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
            {formatNumber(event.total_results, locale)}
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
  const t = useTranslations("events.list");
  return (
    <div className="space-y-10">
      {groups.map(({ label, events }) => (
        <section key={label} className="grid lg:grid-cols-[9rem_1fr] gap-x-8">
          <h2 className="headline text-4xl lg:text-6xl text-muted-foreground/70 lg:sticky lg:top-20 lg:self-start border-b-2 border-rule lg:border-0 pb-2 lg:pb-0">
            {label}
          </h2>
          <div>
            <div className="hidden sm:grid grid-cols-[3.75rem_1fr_auto] gap-x-5 border-b border-rule pb-2 eyebrow lg:pt-3">
              <span>{t("date")}</span>
              <span>{t("race")}</span>
              <span className="flex gap-8">
                <span className="w-36">{t("organizer")}</span>
                <span className="min-w-[4.5rem] text-right">{t("finishers")}</span>
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
