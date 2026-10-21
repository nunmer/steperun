"use client";

import { Button } from "@/components/ui/button";

/**
 * Shown when a page's data query fails (e.g. Supabase is down). Queries throw
 * instead of returning empty data, so an outage is never cached as "no data".
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1>
      <p className="text-muted-foreground">The database isn&apos;t responding. Please try again in a minute.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
