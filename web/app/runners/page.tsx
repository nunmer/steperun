import Link from "next/link";
import { getRunners } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Runners" };
export const revalidate = 60;

const PAGE_SIZE = 30;

export default async function RunnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Number(pageParam ?? 1);
  const { runners, total } = await getRunners({ search: q, page });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Runners</h1>
        <p className="text-muted-foreground">{total.toLocaleString()} registered</p>
      </div>

      {/* Search */}
      <form className="flex gap-2 max-w-sm">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
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
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
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
                <TableCell className="text-muted-foreground">{r.country}</TableCell>
                <TableCell className="text-muted-foreground">{r.city}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" disabled={page <= 1}>
            <Link href={`/runners?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page - 1}`}>
              ← Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="outline" disabled={page >= totalPages}>
            <Link href={`/runners?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page + 1}`}>
              Next →
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
