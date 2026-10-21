import Link from "next/link";
import { getRunners, PAGE_SIZE } from "@/lib/queries";
import { parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Runners</h1>
        <p className="text-muted-foreground text-sm">{total.toLocaleString()} registered</p>
      </div>

      {/* Search */}
      <form className="flex gap-2 max-w-sm">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name (Latin or Cyrillic)…"
          className="flex-1"
        />
        <Button type="submit">Search</Button>
        {q && (
          <Button asChild variant="ghost">
            <Link href="/runners">Clear</Link>
          </Button>
        )}
      </form>

      {q && (
        <p className="text-sm text-muted-foreground">
          {total} result{total !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Country</TableHead>
              <TableHead>City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runners.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <Link href={`/runners/${r.id}`} className="hover:text-primary hover:underline">
                    {r.full_name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{r.country}</TableCell>
                <TableCell className="text-muted-foreground">{r.city}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        href={(p) => buildHref("/runners", { q, page: p })}
      />
    </div>
  );
}
