import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const tones = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
] as const;

const sizes = {
  xs: "size-6 text-[9px]",
  sm: "size-7 text-[10px]",
  md: "size-8 text-[11px]",
  lg: "size-9 text-xs",
  xl: "size-11 text-sm",
} as const;

function toneFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return tones[hash % tones.length];
}

export function UserAvatar({
  name,
  email,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  email?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const source = name || email || "?";
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold leading-none tracking-wide",
        sizes[size],
        toneFor(source),
        className,
      )}
      title={name ?? email ?? undefined}
      aria-hidden="true"
    >
      {initials(name, email)}
    </span>
  );
}
