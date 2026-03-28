import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4 sm:gap-6">
        <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="rounded-lg border overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none border-b last:border-b-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
