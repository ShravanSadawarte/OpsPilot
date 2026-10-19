import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  CreditCard,
  Eye,
  MessageSquare,
  Minus,
  Settings2,
  ShieldCheck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  isKnownPriority,
  isKnownStatus,
  isKnownType,
  priorityLabel,
  statusLabel,
  typeLabel,
  type Priority,
  type WorkItemStatus,
  type WorkItemType,
} from "@/lib/status";

const statusConfig: Record<
  WorkItemStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  OPEN: {
    label: "Open",
    icon: Circle,
    className: "border-info/25 bg-info/10 text-info",
  },
  IN_PROGRESS: {
    label: "In progress",
    icon: CircleDot,
    className: "border-primary/25 bg-primary/10 text-primary",
  },
  BLOCKED: {
    label: "Blocked",
    icon: Ban,
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  IN_REVIEW: {
    label: "In review",
    icon: Eye,
    className: "border-warning/25 bg-warning/10 text-warning",
  },
  RESOLVED: {
    label: "Resolved",
    icon: CheckCircle2,
    className: "border-success/25 bg-success/10 text-success",
  },
  CLOSED: {
    label: "Closed",
    icon: Archive,
    className: "border-border bg-muted text-muted-foreground",
  },
};

const priorityConfig: Record<
  Priority,
  { label: string; icon: LucideIcon; className: string }
> = {
  LOW: {
    label: "Low",
    icon: ArrowDown,
    className: "border-border bg-muted text-muted-foreground",
  },
  MEDIUM: {
    label: "Medium",
    icon: Minus,
    className: "border-info/25 bg-info/10 text-info",
  },
  HIGH: {
    label: "High",
    icon: ArrowUp,
    className: "border-warning/25 bg-warning/10 text-warning",
  },
  CRITICAL: {
    label: "Critical",
    icon: AlertTriangle,
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

const typeIcons: Record<WorkItemType, LucideIcon> = {
  INCIDENT: Zap,
  CUSTOMER_ISSUE: MessageSquare,
  ENGINEERING_TASK: Wrench,
  PAYMENT_INVESTIGATION: CreditCard,
  COMPLIANCE_REQUEST: ShieldCheck,
  OPERATIONAL_TASK: Settings2,
};

export function StatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: string;
  className?: string;
  showIcon?: boolean;
}) {
  if (!isKnownStatus(status)) {
    return <Badge variant="outline">{statusLabel(status)}</Badge>;
  }
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("border", config.className, className)}>
      {showIcon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
  showIcon = true,
}: {
  priority: string;
  className?: string;
  showIcon?: boolean;
}) {
  if (!isKnownPriority(priority)) {
    return <Badge variant="outline">{priorityLabel(priority)}</Badge>;
  }
  const config = priorityConfig[priority];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("border", config.className, className)}>
      {showIcon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {config.label}
    </Badge>
  );
}

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const label = typeLabel(type);
  const Icon = isKnownType(type) ? typeIcons[type] : Circle;
  return (
    <Badge variant="outline" className={cn("border-border bg-secondary/60 text-secondary-foreground", className)}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
