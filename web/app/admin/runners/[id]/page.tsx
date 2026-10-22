export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { adminClient, requireAdminPage } from "@/lib/services/admin";
import { isFinishTime } from "@/lib/params";
import { getAdminRunner, getRunnerResults, previewMerge, type MergePreview, type RunnerResult } from "@/lib/admin/runners";
import { BackLink, PageHeader } from "@/components/sheet";
import { RunnerLink, SectionHead, SheetTable, Stat, StatusTag, UserLink, fmtDate } from "@/components/admin/admin-ui";
import { ActionForm, Field, inputClass } from "@/components/admin/action-form";
import {
  mergeRunnersAction, previewMergeAction, setHiddenAction, unclaimRunnerAction, updateRunnerAction,
} from "../actions";

export const metadata = { title: "Runner" };

export default async function AdminRunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ merge?: string; merged?: string }>;
}) {
  await requireAdminPage();
  const [{ id: rawId }, sp] = await Promise.all([params, searchParams]);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const runner = await getAdminRunner(id);
  if (!runner) notFound();

  const mergeId = Number(sp.merge);
  const [results, claims, owner, merge] = await Promise.all([
    getRunnerResults(id),
    adminClient().from("runner_claims").select("id, status, user_id, created_at").eq("runner_id", id).order("created_at", { ascending: false }),
    runner.claimed_by
      ? adminClient().from("user_profiles").select("display_name").eq("id", runner.claimed_by).maybeSingle()
      : Promise.resolve({ data: null }),
    Number.isInteger(mergeId) && mergeId > 0
      ? previewMerge(id, mergeId).catch((e: Error) => e)
      : Promise.resolve(null),
  ]);
  const finishes = results.filter((r) => isFinishTime(r.chip_time)).length;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={<BackLink href="/admin/runners">Runners</BackLink>}
        title={runner.full_name}
        aside={
          <>
            <p className="time text-xs">#{runner.id} · added {fmtDate(runner.created_at)}</p>
            <Link href={`/runners/${runner.id}`} target="_blank" className="text-xs hover:underline">Public profile ↗</Link>
          </>
        }
      />

      {sp.merged && (
        <p role="status" className="text-sm text-positive border-l-2 border-positive pl-3">
          Merged runner #{sp.merged} into this profile.
        </p>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-x-8">
        <Stat label="Results" value={results.length} />
        <Stat label="Finishes" value={finishes} />
        <Stat label="ELO" value={runner.elo_score ?? "—"} />
        <Stat label="Visibility" value={runner.is_hidden ? "Hidden" : "Public"} tone={runner.is_hidden ? "alert" : undefined} />
        <Stat label="Owner" value={<span className="text-2xl">{runner.claimed_by ? <UserLink id={runner.claimed_by} name={owner.data?.display_name as string | undefined} /> : "—"}</span>} />
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHead title="Details" />
          <ActionForm action={updateRunnerAction} label="Save" tone="primary" className="flex-col items-stretch sm:items-start">
            <input type="hidden" name="runner_id" value={id} />
            <Field label="Full name" className="w-full">
              <input name="full_name" defaultValue={runner.full_name} required maxLength={200} className={inputClass} />
            </Field>
            <div className="flex gap-2 w-full">
              <Field label="City" className="flex-1">
                <input name="city" defaultValue={runner.city ?? ""} maxLength={100} className={inputClass} />
              </Field>
              <Field label="Country" className="flex-1">
                <input name="country" defaultValue={runner.country ?? ""} maxLength={100} className={inputClass} />
              </Field>
            </div>
          </ActionForm>
        </section>

        <section className="space-y-6">
          <SectionHead title="Actions" />
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {runner.is_hidden ? "Hidden from lists, rankings and search." : "Hide junk names, teams or test rows from every public list."}
            </p>
            <ActionForm
              action={setHiddenAction}
              label={runner.is_hidden ? "Show again" : "Hide runner"}
              tone={runner.is_hidden ? "outline" : "danger"}
              confirm={runner.is_hidden ? undefined : "Click again to hide"}
            >
              <input type="hidden" name="runner_id" value={id} />
              <input type="hidden" name="hidden" value={String(!runner.is_hidden)} />
            </ActionForm>
          </div>
          {runner.claimed_by && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Remove the owner (revokes their approved claim; coins stay).</p>
              <ActionForm action={unclaimRunnerAction} label="Unclaim profile" tone="danger" confirm="Click again to unclaim">
                <input type="hidden" name="runner_id" value={id} />
                <input name="notes" placeholder="Why (internal)" className={`${inputClass} w-56`} />
              </ActionForm>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Merge a duplicate of the same person into this profile. You&apos;ll see a preview first.
            </p>
            <ActionForm action={previewMergeAction} label="Preview merge">
              <input type="hidden" name="runner_id" value={id} />
              <Field label="Duplicate runner id">
                <input name="drop_id" inputMode="numeric" defaultValue={sp.merge ?? ""} className={`${inputClass} w-36`} />
              </Field>
            </ActionForm>
          </div>
        </section>
      </div>

      {merge && <MergePanel keepId={id} merge={merge} />}

      <section>
        <SectionHead title="Results" aside={`${results.length}`} />
        <ResultsTable results={results} />
      </section>

      {(claims.data ?? []).length > 0 && (
        <section>
          <SectionHead title="Claim history" />
          <SheetTable head={["Claim", "User", "Status", "Filed"]}>
            {(claims.data ?? []).map((c) => (
              <tr key={c.id as number}>
                <td className="time text-xs">#{c.id as number}</td>
                <td><UserLink id={c.user_id as string} /></td>
                <td><StatusTag status={c.status as string} /></td>
                <td className="time text-xs">{fmtDate(c.created_at as string)}</td>
              </tr>
            ))}
          </SheetTable>
        </section>
      )}
    </div>
  );
}

function ResultsTable({ results, highlight }: { results: RunnerResult[]; highlight?: Set<number> }) {
  if (!results.length) return <p className="text-sm text-muted-foreground">No results.</p>;
  return (
    <SheetTable head={["Date", "Event", "Distance", "Bib", "Place", "Chip"]}>
      {results.map((r) => (
        <tr key={r.id} className={highlight?.has(r.id) ? "bg-destructive/10" : undefined}>
          <td className="time text-xs whitespace-nowrap">{fmtDate(r.events?.date_of_event)}</td>
          <td>
            {r.events ? <Link href={`/events/${r.events.slug}`} className="hover:underline">{r.events.name}</Link> : r.event_id}
          </td>
          <td className="text-xs">{r.distance_category ?? "—"}</td>
          <td className="time text-xs">{r.bib_number ?? "—"}</td>
          <td className="time">{r.place ?? "—"}</td>
          <td className="time">{r.chip_time ?? "—"}</td>
        </tr>
      ))}
    </SheetTable>
  );
}

function MergePanel({ keepId, merge }: { keepId: number; merge: MergePreview | Error }) {
  if (merge instanceof Error) {
    return <p role="alert" className="text-sm text-destructive border-l-2 border-destructive pl-3">{merge.message}</p>;
  }
  const { drop, moving, clashes, blocker } = merge;
  return (
    <section className="border-2 border-rule p-4 sm:p-6">
      <SectionHead title="Merge preview" />
      <p className="text-sm mb-4">
        Move <strong>{moving.length}</strong> result(s) from{" "}
        <RunnerLink id={drop.id} name={`#${drop.id} ${drop.full_name}`} /> ({drop.city ?? "no city"}, {drop.country ?? "—"}) into this
        profile, then delete #{drop.id}.
      </p>
      <ResultsTable results={moving} highlight={new Set(clashes.map((c) => c.id))} />
      <div className="mt-4">
        {blocker ? (
          <p role="alert" className="text-sm text-destructive">Can&apos;t merge: {blocker}</p>
        ) : (
          <ActionForm action={mergeRunnersAction} label={`Merge #${drop.id} into #${keepId}`} tone="primary" confirm="Click again: this deletes the duplicate">
            <input type="hidden" name="runner_id" value={keepId} />
            <input type="hidden" name="drop_id" value={drop.id} />
          </ActionForm>
        )}
      </div>
    </section>
  );
}
