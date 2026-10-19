import { Skeleton } from "@/components/ui/skeleton";

export function WorkItemsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading work items">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <Skeleton className="h-10 w-full" />
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-border/60 py-3 last:border-0">
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
