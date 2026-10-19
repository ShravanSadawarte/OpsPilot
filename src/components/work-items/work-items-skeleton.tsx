import { Skeleton } from "@/components/ui/skeleton";

export function WorkItemsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading work items">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <Skeleton className="h-10 w-full" />
        <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
          <Skeleton className="col-span-2 h-10 w-full xl:col-span-1" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card xl:hidden">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 border-b border-border/60 py-4 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden rounded-xl border border-border bg-card p-4 shadow-card xl:block">
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-border/60 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
