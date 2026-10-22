export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { getStats } from "@/lib/queries";
import { deliveryMode } from "@/lib/services/email";
import { ANALYZER_URL } from "@/lib/run-analyzer-service";
import { githubEnabled, githubRepo, recentScrapeRuns } from "@/lib/admin/github";
import { displayNames } from "@/lib/admin/names";
import { PageHeader } from "@/components/sheet";
import { SectionHead, Stat, fmtDate, fmtDateTime } from "@/components/admin/admin-ui";
import { AUDIT_COLUMNS, AuditTable, type AuditRow } from "@/components/admin/audit-table";
import { ActionForm, Field, inputClass } from "@/components/admin/action-form";
import { dispatchScrapeAction, purgeCacheAction } from "./actions";

export const metadata = { title: "Overview" };

const WEEK_MS = 7 * 86_400_000;

async function loadOverview() {
  const db = adminClient();
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
  const count = { count: "exact" as const, head: true };
  const [site, users, newUsers, claimed, hidden, pending, disputes, coins, done, errors, lastScrape, audit] =
    await Promise.all([
      getStats(),
      db.from("user_profiles").select("id", count),
      db.from("user_profiles").select("id", count).gte("created_at", weekAgo),
      db.from("runners").select("id", count).not("claimed_by", "is", null),
      db.from("runners").select("id", count).eq("is_hidden", true),
      db.from("runner_claims").select("id", count).eq("status", "pending"),
      db.from("disputes").select("id", count).eq("status", "open"),
      db.from("user_profiles").select("coins").gt("coins", 0),
      db.from("run_sessions").select("id", count).eq("status", "done").gte("created_at", weekAgo),
      db.from("run_sessions").select("id", count).eq("status", "error").gte("created_at", weekAgo),
      db.from("events").select("name, slug, scraped_at, date_of_event").not("scraped_at", "is", null)
        .order("scraped_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("claim_audit_log").select(AUDIT_COLUMNS).order("id", { ascending: false }).limit(12),
    ]);

  const auditRows = (audit.data ?? []) as AuditRow[];
  return {
    site,
    users: users.count ?? 0,
    newUsers: newUsers.count ?? 0,
    claimed: claimed.count ?? 0,
    hidden: hidden.count ?? 0,
    pending: pending.count ?? 0,
    disputes: disputes.count ?? 0,
    coins: (coins.data ?? []).reduce((sum, p) => sum + ((p.coins as number) ?? 0), 0),
    analysesDone: done.count ?? 0,
    analysesFailed: errors.count ?? 0,
    lastScrape: lastScrape.data as { name: string; slug: string; scraped_at: string; date_of_event: string | null } | null,
    audit: auditRows,
    names: await displayNames(auditRows.map((r) => r.user_id)),
  };
}

const n = (v: number) => v.toLocaleString("en-US");

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const o = await loadOverview();

  return (
    <div className="space-y-12">
      <PageHeader kicker="Admin" title="Overview" aside={`Last import ${fmtDateTime(o.lastScrape?.scraped_at)}`} />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-x-8">
        <Stat label="Pending claims" value={n(o.pending)} href="/admin/claims" tone={o.pending ? "alert" : undefined} />
        <Stat label="Open disputes" value={n(o.disputes)} href="/admin/disputes" tone={o.disputes ? "alert" : undefined} />
        <Stat label="Users" value={n(o.users)} href="/admin/users" />
        <Stat label="New users · 7 d" value={n(o.newUsers)} href="/admin/users" />
        <Stat label="Runners" value={n(o.site.runners)} href="/admin/runners" />
        <Stat label="Claimed profiles" value={n(o.claimed)} href="/admin/runners?filter=claimed" />
        <Stat label="Hidden runners" value={n(o.hidden)} href="/admin/runners?filter=hidden" />
        <Stat label="Events" value={n(o.site.events)} href="/admin/events" />
        <Stat label="Finishes" value={n(o.site.results)} />
        <Stat label="Coins held" value={n(o.coins)} />
        <Stat label="Analyses · 7 d" value={n(o.analysesDone)} href="/admin/sessions?status=done" />
        <Stat label="Failed · 7 d" value={n(o.analysesFailed)} href="/admin/sessions?status=error" />
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <SectionHead title="Results import" aside={githubRepo()} />
          <p className="text-sm mb-4">
            Latest import:{" "}
            {o.lastScrape ? (
              <Link href={`/events/${o.lastScrape.slug}`} className="font-medium hover:underline">{o.lastScrape.name}</Link>
            ) : "—"}{" "}
            <span className="time text-xs text-muted-foreground">race {fmtDate(o.lastScrape?.date_of_event)}</span>
          </p>
          {githubEnabled() ? (
            <>
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading runs…</p>}>
                <ScrapeRuns />
              </Suspense>
              <ActionForm action={dispatchScrapeAction} label="Run scraper now" tone="primary" className="mt-4">
                <Field label="Min year">
                  <input name="min_year" placeholder="last year" className={`${inputClass} w-28`} inputMode="numeric" />
                </Field>
                <Field label="Athletex backfill">
                  <input name="athletex_backfill_from" placeholder="—" className={`${inputClass} w-28`} inputMode="numeric" />
                </Field>
              </ActionForm>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set <code className="time text-xs">GITHUB_ACTIONS_TOKEN</code> (fine-grained, Actions read &amp; write on this
              repo) in Vercel to see scrape runs and start one from here.
            </p>
          )}
        </section>

        <section>
          <SectionHead title="System" />
          <Suspense fallback={<p className="text-sm text-muted-foreground">Checking services…</p>}>
            <SystemChecks />
          </Suspense>
          <div className="mt-6 border-t pt-4">
            <p className="eyebrow mb-2">Site cache</p>
            <p className="text-sm text-muted-foreground mb-3">
              Public pages are cached for 24 h. Purge after a manual data fix so it shows at once.
            </p>
            <ActionForm action={purgeCacheAction} label="Purge site cache" confirm="Click again to purge" />
          </div>
        </section>
      </div>

      <section>
        <SectionHead title="Recent activity" aside={<Link href="/admin/audit" className="hover:underline">Full audit log →</Link>} />
        <AuditTable rows={o.audit} names={o.names} />
      </section>
    </div>
  );
}

async function ScrapeRuns() {
  const runs = await recentScrapeRuns().catch((e: Error) => e);
  if (runs instanceof Error) return <p className="text-sm text-destructive">Could not load runs: {runs.message}</p>;
  if (!runs.length) return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  return (
    <ul className="text-sm">
      {runs.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-4 border-b py-1.5">
          <a href={r.html_url} target="_blank" rel="noopener noreferrer" className="time text-xs hover:underline">
            {fmtDateTime(r.created_at)}
          </a>
          <span className="text-xs text-muted-foreground">{r.event === "schedule" ? "daily" : r.event}</span>
          <span
            className={`time text-xs uppercase ${
              r.conclusion === "success" ? "text-positive" : r.conclusion ? "text-destructive" : "text-primary"
            }`}
          >
            {r.conclusion ?? r.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

async function pingAnalyzer(): Promise<Check> {
  const started = Date.now();
  try {
    const res = await fetch(`${ANALYZER_URL}/`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return { label: "Run analyzer", ok: res.ok, detail: `HTTP ${res.status} in ${Date.now() - started} ms` };
  } catch (e) {
    return { label: "Run analyzer", ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }
}

async function SystemChecks() {
  const env = (name: string) => !!process.env[name];
  const paddle = env("PADDLE_CLIENT_TOKEN") && env("PADDLE_WEBHOOK_SECRET");
  const checks: Check[] = [
    await pingAnalyzer(),
    { label: "Analyzer key", ok: env("RUN_ANALYZER_API_KEY"), detail: env("RUN_ANALYZER_API_KEY") ? "set" : "RUN_ANALYZER_API_KEY missing" },
    { label: "Cache purge secret", ok: env("REVALIDATE_SECRET"), detail: env("REVALIDATE_SECRET") ? "set" : "REVALIDATE_SECRET missing" },
    { label: "Strava", ok: env("STRAVA_CLIENT_ID") && env("STRAVA_CLIENT_SECRET"), detail: env("STRAVA_CLIENT_ID") ? "configured" : "not configured" },
    { label: "Email", ok: env("RESEND_API_KEY"), detail: `delivery: ${deliveryMode()}` },
    { label: "Paddle", ok: paddle, detail: paddle ? (process.env.PADDLE_ENVIRONMENT ?? "sandbox") : "off (earn-only coins)" },
  ];
  return (
    <ul className="text-sm">
      {checks.map((c) => (
        <li key={c.label} className="grid grid-cols-[1rem_9rem_1fr] items-baseline gap-2 border-b py-1.5">
          <span className={c.ok ? "text-positive" : "text-caution"} aria-label={c.ok ? "ok" : "attention"}>{c.ok ? "●" : "○"}</span>
          <span>{c.label}</span>
          <span className="time text-xs text-muted-foreground truncate">{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}
