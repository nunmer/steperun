"use client";

/**
 * Shown when a page's data query fails (e.g. Supabase is down). Queries throw
 * instead of returning empty data, so an outage is never cached as "no data".
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-10 sm:py-16 max-w-2xl">
      <p className="eyebrow">Timing down</p>
      <h1 className="headline text-6xl sm:text-7xl mt-2">Results are temporarily unavailable</h1>
      <p className="mt-6 text-muted-foreground">The database isn&apos;t responding. Please try again in a minute.</p>
      <button
        onClick={reset}
        className="mt-8 h-10 px-4 rounded-sm bg-foreground text-background text-sm font-semibold hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
