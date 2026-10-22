import { Skeleton } from "@/components/ui/skeleton";

/** Loading state shaped like a sheet page: masthead, filter rows, ruled lines. */
export function SheetSkeleton({
  title,
  filters = 1,
  rows = 12,
}: {
  title: string;
  filters?: number;
  rows?: number;
}) {
  return (
    <div aria-busy="true">
      <header className="border-b-2 border-rule pb-4 mb-6 sm:mb-8">
        <h1 className="headline text-5xl sm:text-7xl text-muted-foreground/50">{title}</h1>
      </header>
      {Array.from({ length: filters }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b py-3">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-2/3 max-w-md" />
        </div>
      ))}
      <div className="mt-8 border-t border-rule">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b py-3.5">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 flex-1 max-w-sm" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
