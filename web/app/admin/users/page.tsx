export const dynamic = "force-dynamic";

import { adminClient, getAuthUsers, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, likeEscape, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { SearchBox, SheetTable, UserLink, fmtDate } from "@/components/admin/admin-ui";

export const metadata = { title: "Users" };

const FILTERS = { all: "all", admins: "admins", coins: "with coins" } as const;
type Filter = keyof typeof FILTERS;
const MAX_EMAIL_MATCHES = 200;

interface ProfileRow {
  id: string;
  display_name: string | null;
  coins: number;
  trust_score: number;
  is_admin: boolean;
  created_at: string;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const filter: Filter = sp.filter && sp.filter in FILTERS ? (sp.filter as Filter) : "all";
  const page = parsePage(sp.page);
  const authUsers = await getAuthUsers();

  let query = adminClient()
    .from("user_profiles")
    .select("id, display_name, coins, trust_score, is_admin, created_at", { count: "exact" });
  if (q.includes("@")) {
    const needle = q.toLowerCase();
    const ids = [...authUsers.values()].filter((u) => u.email?.toLowerCase().includes(needle)).map((u) => u.id);
    query = query.in("id", ids.slice(0, MAX_EMAIL_MATCHES));
  } else if (q) {
    query = query.ilike("display_name", `%${likeEscape(q)}%`);
  }
  if (filter === "admins") query = query.eq("is_admin", true);
  if (filter === "coins") query = query.gt("coins", 0);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(...pageRange(page));
  if (error) throw new Error(`[admin] users failed: ${error.message}`);
  const users = (data ?? []) as ProfileRow[];

  const ids = users.map((u) => u.id);
  const { data: claimed } = ids.length
    ? await adminClient().from("runners").select("id, claimed_by").in("claimed_by", ids)
    : { data: [] };
  const claimedBy = new Map((claimed ?? []).map((r) => [r.claimed_by as string, r.id as number]));
  const total = count ?? 0;
  const href = (p: number, f: Filter = filter) => adminHref("/admin/users", { q, filter: f === "all" ? undefined : f, page: p });

  return (
    <div>
      <PageHeader kicker="Admin" title="Users" aside={`${total.toLocaleString()} accounts`}>
        <FilterRow label="Show">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <FilterLink key={f} href={href(1, f)} active={f === filter}>{FILTERS[f]}</FilterLink>
          ))}
        </FilterRow>
      </PageHeader>

      <SearchBox q={q} placeholder="Name or email" hidden={{ filter: filter === "all" ? undefined : filter }} />

      {users.length === 0 ? (
        <EmptyState>No users match.</EmptyState>
      ) : (
        <SheetTable head={["User", "Email", "Coins", "Trust", "Profile", "Joined", "Last sign-in"]}>
          {users.map((u) => {
            const auth = authUsers.get(u.id);
            return (
              <tr key={u.id}>
                <td className="font-medium whitespace-nowrap">
                  <UserLink id={u.id} name={u.display_name} />
                  {u.is_admin && <span className="ml-2 time text-[10px] text-primary">ADMIN</span>}
                </td>
                <td className="text-muted-foreground break-all">{auth?.email ?? "—"}</td>
                <td className="time">{u.coins}</td>
                <td className="time">{u.trust_score}</td>
                <td className="time text-xs">{claimedBy.has(u.id) ? `#${claimedBy.get(u.id)}` : "—"}</td>
                <td className="time text-xs whitespace-nowrap">{fmtDate(u.created_at)}</td>
                <td className="time text-xs whitespace-nowrap text-muted-foreground">{fmtDate(auth?.last_sign_in_at)}</td>
              </tr>
            );
          })}
        </SheetTable>
      )}

      <div className="mt-4">
        <Pagination page={page} totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)} href={(p) => href(p)} />
      </div>
    </div>
  );
}
