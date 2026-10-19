import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  id?: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  description?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export function fieldIds(
  id: string,
  options: { description?: unknown; error?: unknown } = {},
) {
  const ids: string[] = [];
  if (options.description) ids.push(`${id}-description`);
  if (options.error) ids.push(`${id}-error`);
  return ids.length ? ids.join(" ") : undefined;
}

export function Field({
  id,
  label,
  required,
  optional,
  description,
  error,
  children,
  className,
}: FieldProps) {
  const labelId = id ? `${id}-label` : undefined;
  const descriptionId = id && description ? `${id}-description` : undefined;
  const errorId = id && error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <label
          id={labelId}
          htmlFor={id}
          className="text-[13px] font-medium leading-none text-foreground"
        >
          {label}
          {required ? (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {optional ? (
          <span className="text-[11px] text-muted-foreground">Optional</span>
        ) : null}
      </div>
      {children}
      {description ? (
        <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
