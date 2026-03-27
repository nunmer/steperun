import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-8 text-center space-y-4">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Runners
          <br />
          <span className="text-primary">Database</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every runner. Every race. Every finish line — from 2015 to today.
        </p>
        <div className="flex gap-3 justify-center">
          <Skeleton className="h-11 w-36 rounded-md" />
          <Skeleton className="h-11 w-36 rounded-md" />
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Database at a glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </section>

      {/* Events */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Race events</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}
