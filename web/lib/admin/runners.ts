import { adminClient } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { invalidateAllResults } from "@/lib/cache";
import { AdminInputError } from "./action";

export interface AdminRunner {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
  is_hidden: boolean;
  claimed_by: string | null;
  elo_score: number | null;
  elo_level: number | null;
  created_at: string;
}

export interface RunnerResult {
  id: number;
  event_id: number;
  distance_category: string | null;
  place: number | null;
  chip_time: string | null;
  bib_number: string | null;
  events: { slug: string; name: string; date_of_event: string | null } | null;
}

export const RUNNER_COLUMNS = "id, full_name, country, city, is_hidden, claimed_by, elo_score, elo_level, created_at";

export async function getAdminRunner(id: number): Promise<AdminRunner | null> {
  const { data, error } = await adminClient().from("runners").select(RUNNER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`[admin] runner ${id} failed: ${error.message}`);
  return data as AdminRunner | null;
}

export async function getRunnerResults(id: number): Promise<RunnerResult[]> {
  const { data, error } = await adminClient()
    .from("results")
    .select("id, event_id, distance_category, place, chip_time, bib_number, events ( slug, name, date_of_event )")
    .eq("runner_id", id)
    .order("id", { ascending: false });
  if (error) throw new Error(`[admin] results for ${id} failed: ${error.message}`);
  return (data ?? []) as unknown as RunnerResult[];
}

export interface MergePreview {
  keep: AdminRunner;
  drop: AdminRunner;
  moving: RunnerResult[];
  clashes: RunnerResult[];
  /** Why the merge is refused, if it is. */
  blocker: string | null;
}

/**
 * What merging `dropId` into `keepId` would do. Same guards as
 * scripts/merge_runners.py: refuse when the duplicate is claimed by someone
 * else, or when both have a result in the same event and distance. Here also
 * when the duplicate has any claim: deleting it would cascade-delete the
 * claim history and its disputes.
 */
export async function previewMerge(keepId: number, dropId: number): Promise<MergePreview> {
  if (keepId === dropId) throw new AdminInputError("Pick a different runner to merge.");
  const [keep, drop] = await Promise.all([getAdminRunner(keepId), getAdminRunner(dropId)]);
  if (!keep || !drop) throw new AdminInputError(`Runner ${!keep ? keepId : dropId} not found.`);

  const [keepResults, moving, claims] = await Promise.all([
    getRunnerResults(keepId),
    getRunnerResults(dropId),
    adminClient().from("runner_claims").select("id", { count: "exact", head: true }).eq("runner_id", dropId),
  ]);
  const slots = new Set(keepResults.map((r) => `${r.event_id}|${r.distance_category}`));
  const clashes = moving.filter((r) => slots.has(`${r.event_id}|${r.distance_category}`));

  let blocker: string | null = null;
  if (drop.claimed_by && drop.claimed_by !== keep.claimed_by) blocker = "The duplicate is claimed by a different user.";
  else if (clashes.length) blocker = "Both profiles have a result in the same event and distance: probably two people.";
  else if (claims.count) {
    blocker = `The duplicate has ${claims.count} claim(s) (any status); merging would delete them and their disputes. Merge the other way round, or resolve them first.`;
  }

  return { keep, drop, moving, clashes, blocker };
}

/** Move every result from `dropId` to `keepId`, then delete `dropId`. */
export async function mergeRunners(keepId: number, dropId: number, adminId: string): Promise<string> {
  const preview = await previewMerge(keepId, dropId);
  if (preview.blocker) throw new AdminInputError(preview.blocker);

  const db = adminClient();
  if (preview.moving.length) {
    const { error } = await db.from("results").update({ runner_id: keepId }).eq("runner_id", dropId);
    if (error) throw new Error(`Moving results failed: ${error.message}`);
  }
  const { count } = await db.from("results").select("id", { count: "exact", head: true }).eq("runner_id", dropId);
  if (count) throw new Error(`${count} results are still on #${dropId}; runner not deleted.`);

  const { error: deleteError } = await db.from("runners").delete().eq("id", dropId);
  if (deleteError) throw new Error(`Results moved, but deleting #${dropId} failed: ${deleteError.message}`);

  invalidateAllResults();
  await logAudit({
    event_type: "admin_runner_merged",
    user_id: adminId,
    runner_id: keepId,
    payload: { dropped: dropId, dropped_name: preview.drop.full_name, moved: preview.moving.length },
  });
  return `Merged ${preview.moving.length} result(s) from #${dropId}. ELO updates on the next scraper run (or run calculate_elo.py).`;
}
