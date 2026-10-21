import { cn } from "@/lib/utils";

// Dot colour per organizer; unknown organizers fall back to a neutral dot.
const ORGANIZER_DOT: Record<string, string> = {
  "Almaty Marathon": "bg-sky-500",
  Athletex: "bg-rose-500",
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-2 py-0.5",
        "text-[11px] font-medium text-muted-foreground backdrop-blur-sm",
        className,
      )}
      title={`Organizer: ${organizer}`}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", ORGANIZER_DOT[organizer] ?? "bg-muted-foreground")}
      />
      {organizer}
    </span>
  );
}
