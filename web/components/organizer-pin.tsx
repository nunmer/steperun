import { cn } from "@/lib/utils";

// A small square per timing source; unknown organizers fall back to neutral.
const ORGANIZER_MARK: Record<string, string> = {
  "Almaty Marathon": "bg-chart-4",
  Athletex: "bg-chart-2",
};

export function OrganizerPin({
  organizer,
  className,
}: {
  organizer: string | null | undefined;
  className?: string;
}) {
  if (!organizer) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      title={`Timing: ${organizer}`}
    >
      <span aria-hidden className={cn("size-2 shrink-0", ORGANIZER_MARK[organizer] ?? "bg-muted-foreground")} />
      {organizer}
    </span>
  );
}
