import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getRunners, PAGE_SIZE } from "@/lib/queries";
import { parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export async function generateMetadata() {
  const t = await getTranslations("runners.list");
  return { title: t("title") };
}
export default async function RunnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: rawQ, page: pageParam } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) || undefined;
  const t = await getTranslations("runners.list");
  const n = (chunks: React.ReactNode) => <span className="time text-foreground">{chunks}</span>;
  const requested = parsePage(pageParam);
  let { rows: runners, total } = await getRunners(q, requested);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  if (page !== requested) ({ rows: runners, total } = await getRunners(q, page));

  return (
    <div>
      <PageHeader
        title={t("title")}
        aside={
          q ? (
            <span>{t.rich("matches", { count: total, q, n })}</span>
          ) : (
            <span>{t.rich("onRecord", { count: total, n })}</span>
          )
        }
      >
        <form className="flex gap-2 max-w-xl" role="search">
          <input
            name="q"
            defaultValue={q}
            aria-label={t("nameLabel")}
            placeholder={t("placeholder")}
            className="h-11 min-w-0 flex-1 rounded-sm border border-input bg-card px-3 text-base outline-none focus:border-foreground"
          />
          <button className="h-11 px-4 rounded-sm bg-foreground text-background text-sm font-semibold hover:opacity-90">
            {t("search")}
          </button>
          {q && (
            <Link href="/runners" className="h-11 px-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
              {t("clear")}
            </Link>
          )}
        </form>
      </PageHeader>

      {runners.length === 0 ? (
        <EmptyState>
          {t("empty")}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colCity")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("colCountry")}</TableHead>
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
