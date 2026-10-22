import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Small server-rendered pieces shared by the admin pages: stat cells, the
 * sheet-style table, a search box and date/user formatting.
 */

export function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: "alert" }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className={cn("headline text-4xl mt-1 tabular-nums", tone === "alert" && "text-primary")}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block border-b py-3 hover:bg-muted/40 transition-colors">{body}</Link>
  ) : (
    <div className="border-b py-3">{body}</div>
  );
}

export function SectionHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-rule pb-2 mb-3">
      <h2 className="headline text-3xl">{title}</h2>
      {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
    </div>
  );
}

/** Sheet table: eyebrow headers over an ink rule, hairline rows, scrolls sideways on phones. */
export function SheetTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            {head.map((h) => (
              <th key={h} className="eyebrow font-normal py-2 pr-4 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}

/** GET search form that keeps the other params. */
export function SearchBox({ q, placeholder, hidden = {} }: { q?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form className="flex gap-2 mb-4" role="search">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-9 flex-1 max-w-md rounded-sm border border-input bg-card px-3 text-sm outline-none focus-visible:border-foreground"
      />
      <button className="h-9 px-3 rounded-sm border border-foreground text-sm font-medium hover:bg-foreground hover:text-background transition-colors">
        Search
      </button>
    </form>
  );
}

export function StatusTag({ status }: { status: string }) {
  const tone =
    status === "pending" || status === "open" || status === "analyzing" || status === "extracting"
      ? "text-primary border-primary/50"
      : status === "approved" || status === "done" || status === "resolved_upheld"
        ? "text-positive border-positive/40"
        : status === "rejected" || status === "error"
          ? "text-destructive border-destructive/40"
          : "text-muted-foreground border-border";
  return <span className={cn("time text-[11px] uppercase px-1.5 py-0.5 border rounded-sm whitespace-nowrap", tone)}>{status.replace(/_/g, " ")}</span>;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Almaty" });
const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty",
});

export function fmtDate(iso: string | null | undefined): string {
  return iso ? DATE_FMT.format(new Date(iso)) : "—";
}

/** Short date + time in Almaty time. */
export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? DATETIME_FMT.format(new Date(iso)) : "—";
}

export function UserLink({ id, name }: { id: string | null | undefined; name?: string | null }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  return (
    <Link href={`/admin/users/${id}`} className="hover:underline">
      {name || <span className="time text-xs">{id.slice(0, 8)}</span>}
    </Link>
  );
}

export function RunnerLink({ id, name }: { id: number | null | undefined; name?: string | null }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  return (
    <Link href={`/admin/runners/${id}`} className="hover:underline">
      {name ?? `#${id}`}
    </Link>
  );
}
