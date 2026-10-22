import Link from "next/link";
import { getRunners, PAGE_SIZE } from "@/lib/queries";
import { parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Runners" };
export const revalidate = 86400;

export default async function RunnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: rawQ, page: pageParam } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) || undefined;
  const requested = parsePage(pageParam);
  let { rows: runners, total } = await getRunners(q, requested);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  if (page !== requested) ({ rows: runners, total } = await getRunners(q, page));

  return (
    <div>
      <PageHeader
        title="Runners"
        aside={
          q ? (
            <span>
              <span className="time text-foreground">{total.toLocaleString()}</span> match
              {total === 1 ? "" : "es"} for “{q}”
            </span>
          ) : (
            <span>
              <span className="time text-foreground">{total.toLocaleString()}</span> runners on record
            </span>
          )
        }
      >
        <form className="flex gap-2 max-w-xl" role="search">
          <input
            name="q"
            defaultValue={q}
            aria-label="Runner name"
            placeholder="Name, in Latin or Cyrillic"
            className="h-11 min-w-0 flex-1 rounded-sm border border-input bg-card px-3 text-base outline-none focus:border-foreground"
          />
          <button className="h-11 px-4 rounded-sm bg-foreground text-background text-sm font-semibold hover:opacity-90">
            Search
          </button>
          {q && (
            <Link href="/runners" className="h-11 px-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
              Clear
            </Link>
          )}
        </form>
      </PageHeader>

      {runners.length === 0 ? (
        <EmptyState>
          No runner matches that name. Try the spelling from your race registration, or the other alphabet.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="hidden sm:table-cell">Country</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runners.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-normal">
                  <Link href={`/runners/${r.id}`} className="font-medium hover:text-primary">
                    {r.full_name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.city || "—"}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{r.country || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} href={(p) => buildHref("/runners", { q, page: p })} />
      </div>
    </div>
  );
}
