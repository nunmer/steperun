import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { approveClaimAction, rejectClaimAction } from "./actions";

export const dynamic = "force-dynamic";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export default async function AdminClaimsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/");

  const db = adminClient();

  // Check admin
  const { data: profile } = await db
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!(profile as any)?.is_admin) redirect("/");

  // Fetch pending claims with all related info
  const { data: claims } = await db
    .from("runner_claims")
    .select(`
      id, trust_score_at_claim, strava_match_score, strava_match_detail, created_at,
      runners ( id, full_name, country, city ),
      user_profiles!runner_claims_user_id_fkey ( id, display_name )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // Fetch auth user emails + strava status for each claimant
  const claimantIds = [...new Set((claims ?? []).map((c: any) => c.user_profiles?.id).filter(Boolean))];

  const [authUsersRes, stravaRes] = await Promise.all([
    db.auth.admin.listUsers(),
    db.from("strava_tokens").select("user_id, athlete_id, last_synced_at").in("user_id", claimantIds),
  ]);

  const emailMap = new Map<string, string>(
    (authUsersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );
  const stravaMap = new Map<string, { athlete_id: number; last_synced_at: string | null }>(
    ((stravaRes.data ?? []) as any[]).map((t) => [t.user_id, t])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pending Claims</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {(claims ?? []).length} claim{(claims ?? []).length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      {(claims ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">All caught up — no pending claims.</p>
      ) : (
        <div className="space-y-4">
          {((claims ?? []) as any[]).map((claim) => {
            const runner = claim.runners;
            const claimant = claim.user_profiles;
            const email = emailMap.get(claimant?.id) ?? "—";
            const strava = stravaMap.get(claimant?.id);

            return (
              <Card key={claim.id}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  {/* Runner */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Runner</p>
                      <Link
                        href={`/runners/${runner?.id}`}
                        className="font-semibold hover:underline text-lg"
                        target="_blank"
                      >
                        {runner?.full_name}
                      </Link>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {runner?.country && <Badge variant="secondary">{runner.country}</Badge>}
                        {runner?.city && <Badge variant="outline">{runner.city}</Badge>}
                      </div>
                    </div>

                    <div className="text-right text-sm text-muted-foreground">
                      Submitted {new Date(claim.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Claimant info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                      <p className="font-medium break-all">{email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Display name</p>
                      <p className="font-medium">{claimant?.display_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Trust score</p>
                      <p className="font-bold text-[#22c55e]">{claim.trust_score_at_claim}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Strava</p>
                      {strava ? (
                        <a
                          href={`https://www.strava.com/athletes/${strava.athlete_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-500 hover:underline font-medium"
                        >
                          #{strava.athlete_id}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">Not connected</p>
                      )}
                    </div>
                  </div>

                  {/* Strava match detail */}
                  {claim.strava_match_score != null && (
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground mb-0.5">Strava match score</p>
                      <p className="font-medium">{claim.strava_match_score} pts</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <form action={async () => { "use server"; await approveClaimAction(claim.id); }}>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-md text-sm font-medium bg-[#22c55e] text-white hover:opacity-90 transition-opacity"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={async () => { "use server"; await rejectClaimAction(claim.id); }}>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-md text-sm font-medium border hover:bg-muted transition-colors text-destructive border-destructive/30"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
