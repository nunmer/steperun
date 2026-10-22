export const dynamic = "force-dynamic";

import Link from "next/link";
import { adminClient, getAuthUsers, requireAdminPage } from "@/lib/services/admin";
import { parsePage } from "@/lib/params";
import { adminHref, pageRange, ADMIN_PAGE_SIZE } from "@/lib/admin/url";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, FilterLink, FilterRow, PageHeader } from "@/components/sheet";
import { Pagination } from "@/components/pagination";
import { StatusTag, UserLink, fmtDate, fmtDateTime } from "@/components/admin/admin-ui";
import { ActionForm, inputClass } from "@/components/admin/action-form";
import { approveClaimAction, rejectClaimAction, revokeClaimAction } from "./actions";

export const metadata = { title: "Claims" };

const STATUSES = ["pending", "approved", "rejected", "superseded", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];

interface ClaimRow {
  id: number;
  status: string;
  user_id: string;
  trust_score_at_claim: number;
  auto_approved: boolean;
  strava_match_score: number | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  runners: { id: number; full_name: string; country: string | null; city: string | null } | null;
  user_profiles: { id: string; display_name: string | null } | null;
  runner_claim_evidence: { id: number }[];
}

export default async function AdminClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status: StatusFilter = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as StatusFilter) : "pending";
  const page = parsePage(sp.page);
  const db = adminClient();

  let query = db
    .from("runner_claims")
    .select(
      `id, status, user_id, trust_score_at_claim, auto_approved, strava_match_score, review_notes, reviewed_at, created_at,
       runners ( id, full_name, country, city ),
       user_profiles!runner_claims_user_id_fkey ( id, display_name ),
       runner_claim_evidence ( id )`,
      { count: "exact" },
    );
  if (status !== "all") query = query.eq("status", status);
  // Pending: oldest first (a queue). Everything else: newest first.
  const pendingFirst = status === "pending";
  const { data, count, error } = await query
    .order("created_at", { ascending: pendingFirst })
    .order("id", { ascending: pendingFirst })
    .range(...pageRange(page));
  if (error) throw new Error(`[admin] claims failed: ${error.message}`);

  const claims = (data ?? []) as unknown as ClaimRow[];
  const userIds = [...new Set(claims.map((c) => c.user_id))];
  const [authUsers, strava] = await Promise.all([
    getAuthUsers(),
    db.from("strava_tokens").select("user_id, athlete_id").in("user_id", userIds),
  ]);
  const stravaMap = new Map((strava.data ?? []).map((t) => [t.user_id as string, t.athlete_id as number]));
  const total = count ?? 0;

  return (
    <div>
      <PageHeader kicker="Admin" title="Claims" aside={`${total.toLocaleString()} ${status === "all" ? "claims" : status}`}>
        <FilterRow label="Status">
          {STATUSES.map((s) => (
            <FilterLink key={s} href={adminHref("/admin/claims", { status: s === "pending" ? undefined : s })} active={s === status}>
              {s}
            </FilterLink>
          ))}
        </FilterRow>
      </PageHeader>

      {claims.length === 0 ? (
        <EmptyState>{status === "pending" ? "All caught up: no pending claims." : "No claims here."}</EmptyState>
      ) : (
        <div className="space-y-4 mb-6">
          {claims.map((claim) => {
            const runner = claim.runners;
            const athleteId = stravaMap.get(claim.user_id);
            return (
              <Card key={claim.id}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="eyebrow mb-1">Claim #{claim.id} · runner</p>
                      <Link href={`/admin/runners/${runner?.id}`} className="font-semibold hover:underline text-lg">
                        {runner?.full_name ?? "Deleted runner"}
                      </Link>
                      <Link href={`/runners/${runner?.id}`} target="_blank" className="ml-2 text-xs text-muted-foreground hover:underline">
                        public ↗
                      </Link>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {runner?.country && <Badge variant="secondary">{runner.country}</Badge>}
                        {runner?.city && <Badge variant="outline">{runner.city}</Badge>}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground space-y-1">
                      <StatusTag status={claim.status} />
                      <p className="time text-xs">Submitted {fmtDate(claim.created_at)}</p>
                      {claim.reviewed_at && <p className="time text-xs">Reviewed {fmtDateTime(claim.reviewed_at)}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                    <Info label="Claimant">
                      <UserLink id={claim.user_id} name={claim.user_profiles?.display_name} />
                    </Info>
                    <Info label="Email">
                      <span className="break-all">{authUsers.get(claim.user_id)?.email ?? "—"}</span>
                    </Info>
                    <Info label="Trust score">
                      <span className="font-bold time text-positive">{claim.trust_score_at_claim}</span>
                      {claim.auto_approved && <span className="ml-1 text-xs text-muted-foreground">auto</span>}
                    </Info>
                    <Info label="Strava">
                      {athleteId ? (
                        <a href={`https://www.strava.com/athletes/${athleteId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          #{athleteId}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      )}
                      {claim.strava_match_score != null && <span className="ml-1 time text-xs">{claim.strava_match_score} pts</span>}
                    </Info>
                    <Info label="Evidence">{claim.runner_claim_evidence.length || "—"}</Info>
                  </div>

                  {claim.review_notes && (
                    <p className="text-sm border-l-2 border-rule pl-3 text-muted-foreground">{claim.review_notes}</p>
                  )}

                  {claim.status === "pending" && (
                    <div className="flex flex-wrap gap-3 items-end pt-1">
                      <ActionForm action={approveClaimAction} label="Approve" tone="positive">
                        <input type="hidden" name="claim_id" value={claim.id} />
                      </ActionForm>
                      <ActionForm action={rejectClaimAction} label="Reject" tone="danger">
                        <input type="hidden" name="claim_id" value={claim.id} />
                        <input name="notes" placeholder="Reason (sent to the claimant)" className={`${inputClass} w-64`} />
                      </ActionForm>
                    </div>
                  )}
                  {claim.status === "approved" && (
                    <ActionForm action={revokeClaimAction} label="Revoke claim" tone="danger" confirm="Click again to revoke">
                      <input type="hidden" name="claim_id" value={claim.id} />
                      <input name="notes" placeholder="Why (internal)" className={`${inputClass} w-64`} />
                    </ActionForm>
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
        href={(p) => adminHref("/admin/claims", { status: status === "pending" ? undefined : status, page: p })}
      />
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="font-medium">{children}</div>
    </div>
  );
}
