import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  MessageSquare,
  Pencil,
  Plus,
  UserMinus,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent } from "@/types/api";
import { formatDateTime, formatRelativeTime, humanizeEnum } from "@/lib/format";
import { priorityLabel, statusLabel } from "@/lib/status";
import { cn } from "@/lib/utils";

const activityIcons: Record<string, LucideIcon> = {
  CREATED: Plus,
  UPDATED: Pencil,
  STATUS_CHANGED: ArrowRight,
  PRIORITY_CHANGED: Flag,
  ASSIGNED: UserPlus,
  UNASSIGNED: UserMinus,
  COMMENT_ADDED: MessageSquare,
  APPROVAL_REQUESTED: ClipboardCheck,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
};

function metaString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function describe(event: ActivityEvent): React.ReactNode {
  const previousStatus = metaString(event.metadata, "previousStatus");
  const nextStatus = metaString(event.metadata, "nextStatus");
  const previousPriority = metaString(event.metadata, "previousPriority");
  const nextPriority = metaString(event.metadata, "nextPriority");
  const assigneeName = metaString(event.metadata, "assigneeName");
  const fields = metaString(event.metadata, "fields");

  switch (event.type) {
    case "CREATED":
      return "created this work item";
    case "UPDATED":
      return fields ? `updated ${fields.replaceAll(", ", ", ")}` : "updated the work item";
    case "STATUS_CHANGED":
      return previousStatus && nextStatus
        ? `moved status from ${statusLabel(previousStatus)} to ${statusLabel(nextStatus)}`
        : "changed the status";
    case "PRIORITY_CHANGED":
      return previousPriority && nextPriority
        ? `changed priority from ${priorityLabel(previousPriority)} to ${priorityLabel(nextPriority)}`
        : "changed the priority";
    case "ASSIGNED":
      return assigneeName ? `assigned this item to ${assigneeName}` : "assigned the item";
    case "UNASSIGNED":
      return "removed the assignee";
    case "COMMENT_ADDED":
      return "added a comment";
    case "APPROVAL_REQUESTED":
      return "requested approval";
    case "APPROVED":
      return "approved this item";
    case "REJECTED":
      return "rejected this item";
    default:
      return humanizeEnum(event.type).toLowerCase();
  }
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/25 p-3.5">
        <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium text-foreground">No activity yet</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Status changes, assignments, comments, and approvals will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="relative">
      {events.map((event, index) => {
        const Icon = activityIcons[event.type] ?? Activity;
        const last = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-border"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border bg-card",
                event.type === "APPROVED"
                  ? "border-success/25 text-success"
                  : event.type === "REJECTED" || event.type === "UNASSIGNED"
                    ? "border-destructive/20 text-destructive"
                    : event.type === "COMMENT_ADDED"
                      ? "border-primary/20 text-primary"
                      : "border-border text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">
                  {event.actor?.name ?? event.actor?.email ?? "System"}
                </span>{" "}
                {describe(event)}
              </p>
              <time
                dateTime={event.createdAt}
                title={formatDateTime(event.createdAt)}
                className="mt-1 block text-[11px] text-muted-foreground/75"
                suppressHydrationWarning
              >
                {formatRelativeTime(event.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
