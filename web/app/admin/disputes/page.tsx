export const dynamic = "force-dynamic";

import Link from "next/link";
import { adminClient, getAuthUsers, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { StatusTag, UserLink, fmtDate, fmtDateTime } from "@/components/admin/admin-ui";
import { ActionForm, inputClass } from "@/components/admin/action-form";
import { transferDisputeAction, upholdDisputeAction } from "./actions";

export const metadata = { title: "Disputes" };

const FILTERS = ["open", "resolved", "all"] as const;
type Filter = (typeof FILTERS)[number];

interface DisputeRow {
  id: number;
  status: string;
  reason: string;
  evidence: unknown;
  disputing_user_id: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  runner_claims: {
    id: number;
    user_id: string;
    status: string;
    trust_score_at_claim: number;
    runners: { id: number; full_name: string; city: string | null } | null;
  } | null;
}

export default async function AdminDisputesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "open";
  const page = parsePage(sp.page);
  const db = adminClient();

  let query = db
    .from("disputes")
    .select(
      `id, status, reason, evidence, disputing_user_id, resolution_notes, resolved_at, created_at,
       runner_claims ( id, user_id, status, trust_score_at_claim, runners ( id, full_name, city ) )`,
      { count: "exact" },
    );
  if (filter === "open") query = query.eq("status", "open");
  if (filter === "resolved") query = query.neq("status", "open");
  const { data, count, error } = await query
    .order("created_at", { ascending: filter === "open" })
    .order("id", { ascending: filter === "open" })
    .range(...pageRange(page));
  if (error) throw new Error(`[admin] disputes failed: ${error.message}`);
  const disputes = (data ?? []) as unknown as DisputeRow[];

  const userIds = [...new Set(disputes.flatMap((d) => [d.disputing_user_id, d.runner_claims?.user_id]).filter(Boolean))] as string[];
  const [authUsers, profiles] = await Promise.all([
    getAuthUsers(),
    db.from("user_profiles").select("id, display_name, trust_score").in("id", userIds),
  ]);
  const profileMap = new Map((profiles.data ?? []).map((p) => [p.id as string, p as { display_name: string | null; trust_score: number }]));
  const total = count ?? 0;

  return (
    <div>
      <PageHeader kicker="Admin" title="Disputes" aside={`${total.toLocaleString()} ${filter === "all" ? "disputes" : filter}`}>
        <FilterRow label="Status">
          {FILTERS.map((f) => (
            <FilterLink key={f} href={adminHref("/admin/disputes", { status: f === "open" ? undefined : f })} active={f === filter}>
              {f}
            </FilterLink>
          ))}
        </FilterRow>
      </PageHeader>

      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        A dispute is filed when someone says an already-claimed profile is theirs. Clear trust-score gaps are settled
        automatically; the rest land here.
      </p>

      {disputes.length === 0 ? (
        <EmptyState>{filter === "open" ? "No open disputes." : "No disputes here."}</EmptyState>
      ) : (
        <div className="space-y-4 mb-6">
          {disputes.map((d) => {
            const claim = d.runner_claims;
            const owner = claim ? profileMap.get(claim.user_id) : undefined;
            const disputer = profileMap.get(d.disputing_user_id);
            return (
              <Card key={d.id}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="eyebrow mb-1">Dispute #{d.id} · runner</p>
                      {claim?.runners ? (
                        <Link href={`/admin/runners/${claim.runners.id}`} className="font-semibold text-lg hover:underline">
                          {claim.runners.full_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Runner deleted</span>
                      )}
                      {claim?.runners?.city && <span className="ml-2 text-sm text-muted-foreground">{claim.runners.city}</span>}
                    </div>
                    <div className="text-right space-y-1">
                      <StatusTag status={d.status} />
                      <p className="time text-xs text-muted-foreground">Filed {fmtDate(d.created_at)}</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <Party
                      label={`Current owner · claim #${claim?.id ?? "—"} (${claim?.status ?? "—"})`}
                      id={claim?.user_id}
                      name={owner?.display_name}
                      email={claim ? authUsers.get(claim.user_id)?.email : undefined}
                      trust={owner?.trust_score ?? claim?.trust_score_at_claim}
                    />
                    <Party
                      label="Disputed by"
                      id={d.disputing_user_id}
                      name={disputer?.display_name}
                      email={authUsers.get(d.disputing_user_id)?.email}
                      trust={disputer?.trust_score}
                    />
                  </div>

                  <div>
                    <p className="eyebrow mb-1">Reason</p>
                    <p className="text-sm whitespace-pre-wrap">{d.reason}</p>
                    {d.evidence != null && (
                      <pre className="time text-[11px] text-muted-foreground mt-2 whitespace-pre-wrap break-all">
                        {JSON.stringify(d.evidence, null, 2).slice(0, 1200)}
                      </pre>
                    )}
                  </div>

                  {d.status === "open" ? (
                    <div className="flex flex-wrap gap-3 items-end">
                      <ActionForm action={upholdDisputeAction} label="Keep owner">
                        <input type="hidden" name="dispute_id" value={d.id} />
                        <input name="notes" placeholder="Resolution notes" className={`${inputClass} w-56`} />
                      </ActionForm>
                      <ActionForm action={transferDisputeAction} label="Transfer to disputer" tone="primary" confirm="Click again to transfer">
                        <input type="hidden" name="dispute_id" value={d.id} />
                        <input name="notes" placeholder="Resolution notes" className={`${inputClass} w-56`} />
                      </ActionForm>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground border-l-2 border-rule pl-3">
                      Resolved {fmtDateTime(d.resolved_at)}{d.resolution_notes ? ` · ${d.resolution_notes}` : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / ADMIN_PAGE_SIZE)}
        href={(p) => adminHref("/admin/disputes", { status: filter === "open" ? undefined : filter, page: p })}
      />
    </div>
  );
}

function Party({ label, id, name, email, trust }: { label: string; id?: string; name?: string | null; email?: string; trust?: number }) {
  return (
    <div className="border-l-2 border-rule pl-3">
      <p className="eyebrow mb-1">{label}</p>
      <p className="font-medium"><UserLink id={id} name={name} /></p>
      <p className="time text-xs text-muted-foreground break-all">{email ?? "—"}</p>
      <p className="text-xs mt-1">Trust <span className="time font-semibold">{trust ?? "—"}</span></p>
    </div>
  );
}
