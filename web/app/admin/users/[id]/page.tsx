export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { adminClient, getAuthUsers, requireAdminPage } from "@/lib/services/admin";
import { BackLink, PageHeader } from "@/components/sheet";
import { RunnerLink, SectionHead, SheetTable, Stat, StatusTag, fmtDate, fmtDateTime } from "@/components/admin/admin-ui";
import { ActionForm, Field, inputClass } from "@/components/admin/action-form";
import { adjustCoinsAction, setAdminAction, setTrustAction } from "../actions";

export const metadata = { title: "User" };

const UUID = /^[0-9a-f-]{36}$/i;

async function loadUser(id: string) {
  const db = adminClient();
  const [profile, claims, ledger, sessions, strava, owned] = await Promise.all([
    db.from("user_profiles").select("*").eq("id", id).maybeSingle(),
    db.from("runner_claims")
      .select("id, status, trust_score_at_claim, created_at, review_notes, runners ( id, full_name )")
      .eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("coin_transactions").select("id, amount, reason, ref_id, created_at")
      .eq("user_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50),
    db.from("run_sessions").select("id, title, status, overall_score, coins_charged, error, created_at")
      .eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("strava_tokens").select("athlete_id, connected_at, last_synced_at").eq("user_id", id).maybeSingle(),
    db.from("runners").select("id, full_name, city").eq("claimed_by", id),
  ]);
  if (profile.error) throw new Error(`[admin] user failed: ${profile.error.message}`);
  return {
    profile: profile.data as { id: string; display_name: string | null; coins: number; trust_score: number; verification_level: number; is_admin: boolean; created_at: string } | null,
    claims: (claims.data ?? []) as unknown as { id: number; status: string; trust_score_at_claim: number; created_at: string; review_notes: string | null; runners: { id: number; full_name: string } | null }[],
    ledger: (ledger.data ?? []) as { id: number; amount: number; reason: string; ref_id: number | null; created_at: string }[],
    sessions: (sessions.data ?? []) as { id: string; title: string; status: string; overall_score: number | null; coins_charged: number; error: string | null; created_at: string }[],
    strava: strava.data as { athlete_id: number; connected_at: string; last_synced_at: string | null } | null,
    owned: (owned.data ?? []) as { id: number; full_name: string; city: string | null }[],
  };
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [u, authUsers] = await Promise.all([loadUser(id), getAuthUsers()]);
  if (!u.profile) notFound();
  const p = u.profile;
  const auth = authUsers.get(id);
  const isSelf = admin.id === id;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={<BackLink href="/admin/users">Users</BackLink>}
        title={p.display_name || auth?.email || "Unnamed user"}
        aside={
          <>
            <p className="time text-xs">{auth?.email ?? "no email"}</p>
            <p className="time text-xs">{auth?.app_metadata?.provider ?? "—"} · joined {fmtDate(p.created_at)}</p>
            {p.is_admin && <p className="time text-xs text-primary">ADMIN</p>}
          </>
        }
      />

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-x-8">
        <Stat label="Coins" value={p.coins} />
        <Stat label="Trust score" value={p.trust_score} />
        <Stat label="Verification" value={`L${p.verification_level}`} />
        <Stat label="Analyses" value={u.sessions.filter((s) => s.status === "done").length} />
        <Stat label="Last sign-in" value={<span className="text-2xl">{fmtDate(auth?.last_sign_in_at)}</span>} />
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHead title="Profile" />
          {u.owned.length ? (
            <ul className="text-sm">
              {u.owned.map((r) => (
                <li key={r.id} className="border-b py-1.5 flex justify-between gap-4">
                  <RunnerLink id={r.id} name={r.full_name} />
                  <span className="text-muted-foreground">{r.city ?? "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No claimed runner profile.</p>
          )}
          <p className="text-sm mt-4">
            <span className="eyebrow mr-2">Strava</span>
            {u.strava ? (
              <>
                <a href={`https://www.strava.com/athletes/${u.strava.athlete_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  #{u.strava.athlete_id}
                </a>
                <span className="time text-xs text-muted-foreground ml-2">
                  connected {fmtDate(u.strava.connected_at)} · synced {fmtDate(u.strava.last_synced_at)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">not connected</span>
            )}
          </p>
        </section>

        <section className="space-y-5">
          <SectionHead title="Manage" />
          <ActionForm action={adjustCoinsAction} label="Apply" tone="primary">
            <input type="hidden" name="user_id" value={id} />
            <Field label="Coins ±">
              <input name="amount" required inputMode="numeric" placeholder="e.g. 50 or -10" className={`${inputClass} w-32`} />
            </Field>
            <Field label="Note (internal)">
              <input name="note" required maxLength={200} placeholder="Why" className={`${inputClass} w-56`} />
            </Field>
          </ActionForm>
          <ActionForm action={setTrustAction} label="Set trust">
            <input type="hidden" name="user_id" value={id} />
            <Field label="Trust score 0–100">
              <input name="trust_score" defaultValue={p.trust_score} inputMode="numeric" className={`${inputClass} w-32`} />
            </Field>
          </ActionForm>
          {isSelf ? (
            <p className="text-xs text-muted-foreground">This is you; your own admin role can&apos;t be changed here.</p>
          ) : (
            <ActionForm
              action={setAdminAction}
              label={p.is_admin ? "Remove admin rights" : "Make admin"}
              tone={p.is_admin ? "danger" : "outline"}
              confirm={p.is_admin ? "Click again to remove" : "Click again to grant"}
            >
              <input type="hidden" name="user_id" value={id} />
              <input type="hidden" name="make_admin" value={String(!p.is_admin)} />
            </ActionForm>
          )}
        </section>
      </div>

      <section>
        <SectionHead title="Claims" />
        {u.claims.length ? (
          <SheetTable head={["Claim", "Runner", "Status", "Trust", "Filed", "Notes"]}>
            {u.claims.map((c) => (
              <tr key={c.id}>
                <td className="time text-xs">#{c.id}</td>
                <td><RunnerLink id={c.runners?.id} name={c.runners?.full_name} /></td>
                <td><StatusTag status={c.status} /></td>
                <td className="time">{c.trust_score_at_claim}</td>
                <td className="time text-xs">{fmtDate(c.created_at)}</td>
                <td className="text-xs text-muted-foreground">{c.review_notes ?? ""}</td>
              </tr>
            ))}
          </SheetTable>
        ) : (
          <p className="text-sm text-muted-foreground">No claims.</p>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHead title="Coin ledger" aside="last 50" />
          {u.ledger.length ? (
            <SheetTable head={["When", "Reason", "Ref", "Amount"]}>
              {u.ledger.map((t) => (
                <tr key={t.id}>
                  <td className="time text-xs whitespace-nowrap">{fmtDateTime(t.created_at)}</td>
                  <td className="text-xs">{t.reason.replace(/_/g, " ")}</td>
                  <td className="time text-xs text-muted-foreground">{t.ref_id ?? ""}</td>
                  <td className={`time text-right ${t.amount > 0 ? "text-positive" : "text-destructive"}`}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                </tr>
              ))}
            </SheetTable>
          ) : (
            <p className="text-sm text-muted-foreground">No coin movements.</p>
          )}
        </section>

        <section>
          <SectionHead title="AI Coach" aside={<Link href={`/admin/sessions?user=${id}`} className="hover:underline">All sessions →</Link>} />
          {u.sessions.length ? (
            <SheetTable head={["When", "Title", "Status", "Score", "Coins"]}>
              {u.sessions.map((s) => (
                <tr key={s.id}>
                  <td className="time text-xs whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                  <td className="text-xs">{s.title}{s.error && <p className="text-destructive">{s.error}</p>}</td>
                  <td><StatusTag status={s.status} /></td>
                  <td className="time">{s.overall_score ?? "—"}</td>
                  <td className="time">{s.coins_charged || "—"}</td>
                </tr>
              ))}
            </SheetTable>
          ) : (
            <p className="text-sm text-muted-foreground">No analyses.</p>
          )}
        </section>
      </div>
    </div>
  );
}
