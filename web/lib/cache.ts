import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

/**
 * Public race data changes only when the scraper imports results (daily) or a
 * profile is claimed, so reads are cached for an hour and purged on demand:
 *   - scraper workflow → POST /api/revalidate → invalidateAllResults()
 *   - claim approval / dispute → invalidateRunner(id)
 */
export const RESULTS_TAG = "results";
export const runnerTag = (id: number) => `runner:${id}`;
const ONE_HOUR = 3600;

export function cachedQuery<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  key: string,
  extraTags: (...args: Args) => string[] = () => [],
): (...args: Args) => Promise<R> {
  return (...args: Args) =>
    unstable_cache(() => fn(...args), [key, JSON.stringify(args)], {
      revalidate: ONE_HOUR,
      tags: [RESULTS_TAG, ...extraTags(...args)],
    })();
}

export function invalidateRunner(runnerId: number): void {
  revalidateTag(runnerTag(runnerId), { expire: 0 });
  revalidatePath(`/runners/${runnerId}`);
}

export function invalidateAllResults(): void {
  revalidateTag(RESULTS_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
