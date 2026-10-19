export const WORK_ITEM_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const WORK_ITEM_TYPES = [
  "INCIDENT",
  "CUSTOMER_ISSUE",
  "ENGINEERING_TASK",
  "PAYMENT_INVESTIGATION",
  "COMPLIANCE_REQUEST",
  "OPERATIONAL_TASK",
] as const;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const TYPE_LABELS: Record<WorkItemType, string> = {
  INCIDENT: "Incident",
  CUSTOMER_ISSUE: "Customer issue",
  ENGINEERING_TASK: "Engineering task",
  PAYMENT_INVESTIGATION: "Payment investigation",
  COMPLIANCE_REQUEST: "Compliance request",
  OPERATIONAL_TASK: "Operational task",
};

/** Mirror of the server-side workflow map, safe to import in client components. */
export const STATUS_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  OPEN: ["IN_PROGRESS", "BLOCKED", "CLOSED"],
  IN_PROGRESS: ["BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"],
  BLOCKED: ["OPEN", "IN_PROGRESS", "CLOSED"],
  IN_REVIEW: ["IN_PROGRESS", "RESOLVED", "BLOCKED", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS", "IN_REVIEW"],
  CLOSED: ["OPEN"],
};

export function isKnownStatus(value: string): value is WorkItemStatus {
  return (WORK_ITEM_STATUSES as readonly string[]).includes(value);
}

export function isKnownPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export function isKnownType(value: string): value is WorkItemType {
  return (WORK_ITEM_TYPES as readonly string[]).includes(value);
}

export function statusLabel(value: string): string {
  return isKnownStatus(value) ? STATUS_LABELS[value] : value.replaceAll("_", " ").toLowerCase();
}

export function priorityLabel(value: string): string {
  return isKnownPriority(value)
    ? PRIORITY_LABELS[value]
    : value.replaceAll("_", " ").toLowerCase();
}

export function typeLabel(value: string): string {
  return isKnownType(value) ? TYPE_LABELS[value] : value.replaceAll("_", " ").toLowerCase();
}

export function roleLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
