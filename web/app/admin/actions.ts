"use server";

import { invalidateAllResults } from "@/lib/cache";
import { logAudit } from "@/lib/services/audit";
import { AdminInputError, fieldText, runAdminAction } from "@/lib/admin/action";
import { dispatchScrape, githubEnabled } from "@/lib/admin/github";
import type { ActionResult } from "@/lib/admin/types";

/** Purge every cached public page and query (same as POST /api/revalidate). */
export async function purgeCacheAction(): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    invalidateAllResults();
    await logAudit({ event_type: "admin_cache_purged", user_id: admin.id });
    return "Site cache purged. Pages refill on their next visit.";
  });
}

const YEAR = /^\d{4}$/;

/** Start the scrape-results workflow on GitHub Actions. */
export async function dispatchScrapeAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    if (!githubEnabled()) throw new AdminInputError("GITHUB_ACTIONS_TOKEN is not set.");
    const minYear = fieldText(fd, "min_year", 4);
    const backfill = fieldText(fd, "athletex_backfill_from", 4);
    if (minYear && minYear !== "0" && !YEAR.test(minYear)) throw new AdminInputError("Min year must be a year or 0.");
    if (backfill && !YEAR.test(backfill)) throw new AdminInputError("Backfill must be a year.");

    await dispatchScrape({ min_year: minYear, athletex_backfill_from: backfill });
    await logAudit({ event_type: "admin_scrape_dispatched", user_id: admin.id, payload: { min_year: minYear, backfill } });
    return "Scrape started. It shows up in the list within a few seconds.";
  });
}
