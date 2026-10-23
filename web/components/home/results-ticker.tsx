import Link from "next/link";
import { useTranslations } from "next-intl";

export interface TickerItem {
  href: string;
  label: string;
  value: string;
  note: string;
}

/**
 * Full-bleed ink band of real finishes and races scrolling past like a
 * stadium LED board. Server-rendered; the list is doubled so the loop is seamless.
 * Pauses on hover/focus so a name can be clicked.
 */
export function ResultsTicker({ items }: { items: TickerItem[] }) {
  const t = useTranslations("home.ticker");
  if (items.length === 0) return null;
  const loop = [...items, ...items];
  return (
    <section
      aria-label={t("label")}
      className="ticker relative w-screen ml-[calc(50%-50vw)] bg-foreground text-background overflow-hidden border-y-4 border-primary"
      style={{ ["--ticker-duration" as string]: `${items.length * 5}s` }}
    >
      <ul className="ticker-track py-3">
        {loop.map((item, i) => (
          <li key={i} aria-hidden={i >= items.length || undefined} className="flex items-baseline shrink-0">
            <Link
              href={item.href}
              tabIndex={i >= items.length ? -1 : undefined}
              className="flex items-baseline gap-3 px-6 hover:text-primary transition-colors"
            >
              <span className="eyebrow !text-background/55">{item.note}</span>
              <span className="headline text-2xl">{item.label}</span>
              <span className="time text-lg text-primary">{item.value}</span>
            </Link>
            <span aria-hidden className="text-primary">◆</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
