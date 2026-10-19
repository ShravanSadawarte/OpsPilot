import { WorkItemStatus } from "@prisma/client";

/**
 * Documented work-item status transition map.
 *
 * Transitions are directional. A transition from status A to status B is
 * allowed only if B appears in the set for A. Invalid transitions are rejected
 * on the server by the work-item service.
 */
const transitions = new Map<WorkItemStatus, Set<WorkItemStatus>>();
transitions.set(WorkItemStatus.OPEN, new Set([
  WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CLOSED,
]));
transitions.set(WorkItemStatus.IN_PROGRESS, new Set([
  WorkItemStatus.BLOCKED, WorkItemStatus.IN_REVIEW, WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED,
]));
transitions.set(WorkItemStatus.BLOCKED, new Set([
  WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED,
]));
transitions.set(WorkItemStatus.IN_REVIEW, new Set([
  WorkItemStatus.IN_PROGRESS, WorkItemStatus.RESOLVED, WorkItemStatus.BLOCKED, WorkItemStatus.CLOSED,
]));
transitions.set(WorkItemStatus.RESOLVED, new Set([
  WorkItemStatus.CLOSED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.IN_REVIEW,
]));
transitions.set(WorkItemStatus.CLOSED, new Set([WorkItemStatus.OPEN])); // reopen only

export const WORK_ITEM_TRANSITIONS: ReadonlyMap<
  WorkItemStatus,
  ReadonlySet<WorkItemStatus>
> = transitions;

/** Whether a transition from `from` to `to` is permitted. */
export function isValidTransition(
  from: WorkItemStatus,
  to: WorkItemStatus,
): boolean {
  if (from === to) return false;
  const allowed = WORK_ITEM_TRANSITIONS.get(from);
  return Boolean(allowed && allowed.has(to));
}

/** Human-readable label for a status. */
export function statusLabel(status: WorkItemStatus): string {
  const labels: Record<WorkItemStatus, string> = {
    [WorkItemStatus.OPEN]: "Open",
    [WorkItemStatus.IN_PROGRESS]: "In Progress",
    [WorkItemStatus.BLOCKED]: "Blocked",
    [WorkItemStatus.IN_REVIEW]: "In Review",
    [WorkItemStatus.RESOLVED]: "Resolved",
    [WorkItemStatus.CLOSED]: "Closed",
  };
  return labels[status];
}
