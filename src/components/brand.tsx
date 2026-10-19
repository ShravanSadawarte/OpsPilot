import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-white/10",
        className,
      )}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-white/25" aria-hidden="true" />
      <Compass className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

export function BrandLockup({
  className,
  markClassName,
  textClassName,
  subtitle,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={markClassName} />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "text-[15px] font-semibold leading-none tracking-[-0.02em]",
            textClassName,
          )}
        >
          OpsPilot
        </span>
        {subtitle ? (
          <span className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
