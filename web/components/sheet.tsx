import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Building blocks of the "results sheet" layout shared by every page:
 * a masthead with a heavy rule, filter rows of underlined links, and rank cells.
 */

interface PageHeaderProps {
  title: React.ReactNode;
  /** Small mono line above the title (a breadcrumb or category). */
  kicker?: React.ReactNode;
  /** Right-hand meta on desktop, under the title on mobile (counts, notes). */
  aside?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, kicker, aside, children }: PageHeaderProps) {
  return (
    <header className="border-b-2 border-rule pb-4 mb-6 sm:mb-8">
      {kicker && <div className="eyebrow mb-2">{kicker}</div>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <h1 className="headline text-5xl sm:text-7xl break-words min-w-0">{title}</h1>
        {aside && <div className="text-sm text-muted-foreground sm:text-right sm:pb-1 shrink-0">{aside}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:text-foreground transition-colors">
      ← {children}
    </Link>
  );
}

/** One labelled row of filters. Wraps on desktop, scrolls sideways on phones. */
export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 sm:gap-6 border-b py-2.5">
      <span className="eyebrow w-16 sm:w-20 shrink-0">{label}</span>
      <div className="flex items-baseline gap-x-4 gap-y-1.5 overflow-x-auto sm:flex-wrap -my-1 py-1 [scrollbar-width:none]">
        {children}
      </div>
    </div>
  );
}

export function FilterLink({
  href,
  active,
  children,
  className,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "whitespace-nowrap text-sm underline-offset-[6px] decoration-2 transition-colors",
        active
          ? "text-foreground font-semibold underline decoration-primary"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Rank number; the podium (1–3) is set heavier and in the signal colour. */
export function Rank({ n }: { n: number | null | undefined }) {
  if (!n) return <span className="time text-muted-foreground">—</span>;
  return (
    <span className={cn("time text-sm", n <= 3 ? "text-primary font-semibold" : "text-muted-foreground")}>
      {n}
    </span>
  );
}

/** "City, Country" with Kazakhstan implied — almost every runner is from KZ. */
export function Place({ city, country }: { city?: string | null; country?: string | null }) {
  const parts = [city, country && country !== "Kazakhstan" && country !== "Казахстан" ? country : null].filter(Boolean);
  return <>{parts.length ? parts.join(", ") : "—"}</>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-muted-foreground border-b">{children}</p>;
}
