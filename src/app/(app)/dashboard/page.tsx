import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Flag,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dashboardMetrics } from "@/server/services/dashboard.service";
import type { DashboardMetrics } from "@/types/api";
import {
  firstName,
  formatDate,
  formatDateTime,
  formatDueDate,
  formatLongDate,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  isOverdueStatus,
  pluralize,
} from "@/lib/format";
import {
  isKnownStatus,
  priorityLabel,
  STATUS_LABELS,
  WORK_ITEM_STATUSES,
  type WorkItemStatus,
} from "@/lib/status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

const statusBarColors: Record<WorkItemStatus, string> = {
  OPEN: "bg-info",
  IN_PROGRESS: "bg-primary",
  BLOCKED: "bg-destructive",
  IN_REVIEW: "bg-warning",
  RESOLVED: "bg-success",
  CLOSED: "bg-muted-foreground/35",
};

const statusDotColors: Record<WorkItemStatus, string> = {
  OPEN: "bg-info",
  IN_PROGRESS: "bg-primary",
  BLOCKED: "bg-destructive",
  IN_REVIEW: "bg-warning",
  RESOLVED: "bg-success",
  CLOSED: "bg-muted-foreground/40",
};

const priorityDotColors: Record<string, string> = {
  CRITICAL: "bg-destructive",
  HIGH: "bg-warning",
  MEDIUM: "bg-info",
  LOW: "bg-muted-foreground/45",
};

type Accent = "blue" | "emerald" | "amber" | "rose";

const accentStyles: Record<Accent, string> = {
  blue: "border-primary/15 bg-primary/10 text-primary",
  emerald: "border-success/15 bg-success/10 text-success",
  amber: "border-warning/15 bg-warning/10 text-warning",
  rose: "border-destructive/15 bg-destructive/10 text-destructive",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const result = await dashboardMetrics(user);
  const data = (await result.json()).data as DashboardMetrics;

  const statusCounts = WORK_ITEM_STATUSES.map((status) => ({
    status,
    count: data.statusSummary.find((entry) => entry.status === status)?.count ?? 0,
  }));
  const totalWork = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
  const activeStatusCounts = statusCounts.filter((entry) => entry.count > 0);
  const openStatusCount = statusCounts
    .filter((entry) => entry.status !== "RESOLVED" && entry.status !== "CLOSED")
    .reduce((sum, entry) => sum + entry.count, 0);

  const hasAttention = data.overdueWork > 0 || data.criticalHighWork > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>{formatLongDate(new Date())}</span>
            <span className="size-1 rounded-full bg-border" aria-hidden="true" />
            <span>
              {data.teamCount} {pluralize(data.teamCount, "team")} in scope
            </span>
          </>
        }
        title={`Welcome back, ${firstName(user.name, user.email)}`}
        description="Your operational picture across the teams you belong to — the work in flight, what needs a decision, and where to go next."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/work-items">
                <ListChecks className="size-4" aria-hidden="true" />
                View work items
              </Link>
            </Button>
            <Button asChild>
              <Link href="/work-items/create">
                <Plus className="size-4" aria-hidden="true" />
                New work item
              </Link>
            </Button>
          </>
        }
      />

      {hasAttention ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-warning/12 text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </span>
            <p className="text-sm leading-relaxed">
              <span className="font-medium text-foreground">
                {formatNumber(data.overdueWork)} {pluralize(data.overdueWork, "item")} overdue
              </span>
              <span className="text-muted-foreground">
                {" "}
                and {formatNumber(data.criticalHighWork)} critical or high-priority open{" "}
                {pluralize(data.criticalHighWork, "item")} need review.
              </span>
            </p>
          </div>
          <a
            href="#attention"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-warning transition-colors hover:text-warning/80"
          >
            Review attention queue
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      ) : null}

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open work"
          value={data.openWork}
          detail={`${formatNumber(data.unassignedWork)} unassigned in your teams`}
          href="/work-items"
          icon={ListChecks}
          accent="blue"
        />
        <MetricCard
          label="My work"
          value={data.myWork}
          detail="Open items assigned to you"
          href={`/work-items?assigneeId=${encodeURIComponent(user.id)}`}
          icon={UserRound}
          accent="emerald"
        />
        <MetricCard
          label="Pending approvals"
          value={data.pendingApprovals}
          detail="Waiting for a decision"
          href="/approvals"
          icon={ClipboardCheck}
          accent="amber"
        />
        <MetricCard
          label="Overdue"
          value={data.overdueWork}
          detail={data.overdueWork > 0 ? "Past due and still open" : "Nothing is past due"}
          href="/work-items?overdue=true"
          icon={Clock3}
          accent="rose"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card id="attention" className="scroll-mt-24">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Attention required</CardTitle>
              <CardDescription className="mt-1">
                Open items that are unassigned, overdue, or critical.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
              <Link href="/work-items">
                View all
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.attentionRequired.length ? (
              <div className="divide-y divide-border/70">
                {data.attentionRequired.map((item) => {
                  const overdue = isOverdueStatus(item.dueDate, item.status);

                  return (
                    <Link
                      key={item.id}
                      href={`/work-items/${item.id}`}
                      className="group flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <span
                        className={cn(
                          "mt-2 size-1.5 shrink-0 rounded-full",
                          priorityDotColors[item.priority] ?? "bg-muted-foreground/40",
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] font-medium text-muted-foreground">
                            {item.publicKey}
                          </span>
                          <PriorityBadge priority={item.priority} showIcon={false} />
                          <StatusBadge status={item.status} showIcon={false} />
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
                          {item.assigneeId ? "Assigned" : "Unassigned"}
                          {item.dueDate ? ` · ${formatDueDate(item.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p
                          className={cn(
                            "text-[11px] font-medium",
                            overdue ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {item.dueDate ? formatDueDate(item.dueDate) : "No due date"}
                        </p>
                        {item.dueDate ? (
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            {formatDate(item.dueDate)}
                          </p>
                        ) : null}
                      </div>
                      <ArrowUpRight
                        className="mt-1 size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="The attention queue is clear"
                description="No open work in your teams is unassigned, overdue, or critical."
                compact
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work distribution</CardTitle>
            <CardDescription>All work items across your teams, by status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {totalWork > 0 ? (
              <>
                <div
                  className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={statusCounts
                    .map((entry) => `${STATUS_LABELS[entry.status]}: ${entry.count}`)
                    .join(", ")}
                >
                  {activeStatusCounts.map((entry) => (
                    <span
                      key={entry.status}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", statusBarColors[entry.status])}
                      style={{ flexGrow: entry.count, minWidth: 4 }}
                    />
                  ))}
                </div>

                <dl className="space-y-2.5">
                  {statusCounts.map((entry) => {
                    const percentage = totalWork > 0 ? (entry.count / totalWork) * 100 : 0;
                    return (
                      <div key={entry.status} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={cn("size-2 shrink-0 rounded-full", statusDotColors[entry.status])}
                          aria-hidden="true"
                        />
                        <dt className="flex-1 text-[13px] text-muted-foreground">
                          {STATUS_LABELS[entry.status]}
                        </dt>
                        <dd className="w-10 text-right text-[13px] font-medium tabular-nums">
                          {formatNumber(entry.count)}
                        </dd>
                        <dd className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatPercent(percentage)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                <div className="flex items-center justify-between border-t border-border/70 pt-4 text-[11px] text-muted-foreground">
                  <span>{formatNumber(openStatusCount)} active</span>
                  <span>{formatNumber(totalWork)} total</span>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Activity}
                title="No work in scope"
                description="Work items will appear here once your teams start tracking work."
                compact
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription className="mt-1">
                The latest changes across the work you can see.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
              <Link href="/work-items">
                Open queue
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length ? (
              <div className="divide-y divide-border/70">
                {data.recentActivity.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Changes to work items will appear here as your team starts moving work forward."
                compact
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your next steps</CardTitle>
            <CardDescription>Jump into the work that is yours to move.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <QuickLink
              href={`/work-items?assigneeId=${encodeURIComponent(user.id)}`}
              icon={UserRound}
              label="My open work"
              count={data.myWork}
            />
            <QuickLink
              href="/work-items?overdue=true"
              icon={Clock3}
              label="Overdue items"
              count={data.overdueWork}
              urgent={data.overdueWork > 0}
            />
            <QuickLink
              href="/approvals"
              icon={ClipboardCheck}
              label="Pending approvals"
              count={data.pendingApprovals}
            />
            <QuickLink
              href="/teams"
              icon={Users}
              label="Teams in directory"
              count={data.teamCount}
            />

            <div className="pt-4">
              <Button asChild className="w-full">
                <Link href="/work-items/create">
                  <Plus className="size-4" aria-hidden="true" />
                  Create work item
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  accent: Accent;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-9 place-items-center rounded-lg border", accentStyles[accent])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <ArrowUpRight
          className="size-4 text-muted-foreground/35 transition-colors group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
      <div className="mt-5">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
          {formatNumber(value)}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  count,
  urgent,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count: number;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span className="grid size-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="flex-1 text-[13px] font-medium text-foreground">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          urgent && count > 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {formatNumber(count)}
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground/35 transition-colors group-hover:text-primary" aria-hidden="true" />
    </Link>
  );
}

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

const activityVerbs: Record<string, string> = {
  CREATED: "created",
  UPDATED: "updated",
  STATUS_CHANGED: "changed the status of",
  PRIORITY_CHANGED: "changed the priority of",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
  COMMENT_ADDED: "commented on",
  APPROVAL_REQUESTED: "requested approval for",
  APPROVED: "approved",
  REJECTED: "rejected",
};

function ActivityRow({ event }: { event: DashboardMetrics["recentActivity"][number] }) {
  const Icon = activityIcons[event.type] ?? Activity;
  const verb = activityVerbs[event.type] ?? "updated";
  const actor = event.actor?.name ?? "System";

  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">{actor}</span> {verb}{" "}
          {event.workItem ? (
            <Link
              href={`/work-items/${event.workItem.id}`}
              className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {event.workItem.publicKey}
            </Link>
          ) : (
            "a work item"
          )}
        </p>
        {event.workItem ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.workItem.title}</p>
        ) : null}
      </div>
      <time
        dateTime={event.createdAt}
        title={formatDateTime(event.createdAt)}
        className="shrink-0 pt-0.5 text-[11px] text-muted-foreground/80"
        suppressHydrationWarning
      >
        {formatRelativeTime(event.createdAt)}
      </time>
    </div>
  );
}
