import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, Clock3, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/http";
import {
  canEditWorkItem,
  canManageTeam,
  canRequestApproval,
  canTransitionWorkItem,
} from "@/lib/permissions";
import { getWorkItem, listActivity, listComments } from "@/server/services/workItem.service";
import { listPendingApprovals } from "@/server/services/approval.service";
import { getTeam } from "@/server/services/team.service";
import type { ActivityEvent, Approval, Comment, WorkItem } from "@/types/api";
import type { WorkItemStatus } from "@/lib/status";
import { isKnownStatus } from "@/lib/status";
import { formatDate, formatDateTime, formatDueDate, formatRelativeTime, isOverdueStatus, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityBadge, StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ActivityTimeline } from "@/components/work-items/activity-timeline";
import { CommentThread } from "@/components/work-items/comment-thread";
import {
  WorkItemActions,
  type ActionMember,
} from "@/components/work-items/work-item-actions";

export const metadata: Metadata = {
  title: "Work item",
};

export const dynamic = "force-dynamic";

export default async function WorkItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let item: WorkItem;
  try {
    const result = await getWorkItem(user, id);
    item = (await result.json()).data as WorkItem;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const [commentsResult, activityResult, pendingApprovalsResult] = await Promise.all([
    listComments({ user, workItemId: id, pagination: { page: 1, pageSize: 50 } }),
    listActivity({ user, workItemId: id, pagination: { page: 1, pageSize: 50 } }),
    listPendingApprovals(user),
  ]);

  const commentsBody = (await commentsResult.json()) as {
    data?: { items?: Comment[]; meta?: { total?: number } };
  };
  const activityBody = (await activityResult.json()) as {
    data?: { items?: ActivityEvent[]; meta?: { total?: number } };
  };
  const approvalsBody = (await pendingApprovalsResult.json()) as { data?: Approval[] };

  const comments = commentsBody.data?.items ?? [];
  const commentTotal = commentsBody.data?.meta?.total ?? comments.length;
  const activity = activityBody.data?.items ?? [];
  const activityTotal = activityBody.data?.meta?.total ?? activity.length;
  const pendingApproval =
    (approvalsBody.data ?? []).find((approval) => approval.workItem.id === item.id) ?? null;

  const teamResult = await getTeam(user, item.teamId);
  const teamBody = (await teamResult.json()) as {
    data?: { team?: { memberships?: ActionMember[] } };
  };
  const members = teamBody.data?.team?.memberships ?? [];

  const [canEdit, canTransition, canRequest, canManage] = await Promise.all([
    canEditWorkItem(user, item),
    isKnownStatus(item.status)
      ? canTransitionWorkItem(
          user,
          { teamId: item.teamId, status: item.status as WorkItemStatus },
          item.status as WorkItemStatus,
        )
      : Promise.resolve(false),
    canRequestApproval(user, { teamId: item.teamId, reporterId: item.reporterId }),
    canManageTeam(user, item.teamId),
  ]);

  const canClaim =
    !item.assigneeId && item.status !== "RESOLVED" && item.status !== "CLOSED";
  const isOverdue = isOverdueStatus(item.dueDate, item.status);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/work-items"
        backLabel="Work items"
        eyebrow={
          <>
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {item.publicKey}
            </span>
            <span className="size-1 rounded-full bg-border" aria-hidden="true" />
            <TypeBadge type={item.type} />
            <Badge variant="outline" className="font-mono text-[10px]">
              {item.team.key}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{item.team.name}</span>
          </>
        }
        title={item.title}
        actions={
          <WorkItemActions
            item={{
              id: item.id,
              publicKey: item.publicKey,
              title: item.title,
              status: item.status,
              version: item.version,
              assigneeId: item.assigneeId,
            }}
            members={members}
            permissions={{
              canEdit,
              canTransition,
              canAssign: canManage && members.length > 0,
              canRequestApproval: canRequest && !pendingApproval,
              canClaim,
            }}
            pendingApproval={
              pendingApproval
                ? {
                    id: pendingApproval.id,
                    requestedBy: pendingApproval.requestedBy,
                  }
                : null
            }
          />
        }
      />

      {pendingApproval ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-warning/12 text-warning">
              <Clock3 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Approval pending</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Requested by{" "}
                {pendingApproval.requestedBy.name ?? pendingApproval.requestedBy.email}{" "}
                <span suppressHydrationWarning>
                  {formatRelativeTime(pendingApproval.createdAt)}
                </span>
                . A team lead, manager, or administrator can decide.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/approvals">
              <ClipboardCheck className="size-4" aria-hidden="true" />
              Open approval queue
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {item.description ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {item.description}
                </p>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4">
                  <p className="text-xs font-medium text-foreground">No description provided</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Add context when you edit this item so the next person can act without
                    guessing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Discussion</CardTitle>
              <CardDescription>
                {commentTotal} {pluralize(commentTotal, "comment")} · visible to active team
                members and recorded in activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommentThread
                workItemId={item.id}
                initialComments={comments}
                total={commentTotal}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3.5">
                <DetailRow label="Status">
                  <StatusBadge status={item.status} />
                </DetailRow>
                <DetailRow label="Priority">
                  <PriorityBadge priority={item.priority} />
                </DetailRow>
                <DetailRow label="Assignee">
                  {item.assignee ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar
                        name={item.assignee.name}
                        email={item.assignee.email}
                        size="xs"
                      />
                      <span className="truncate">
                        {item.assignee.name ?? item.assignee.email}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </DetailRow>
                <DetailRow label="Reporter">
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      name={item.reporter.name}
                      email={item.reporter.email}
                      size="xs"
                    />
                    <span className="truncate">{item.reporter.name ?? item.reporter.email}</span>
                  </span>
                </DetailRow>
                <Separator />
                <DetailRow label="Due date">
                  <span
                    className={cn(isOverdue ? "font-medium text-destructive" : "text-foreground")}
                    title={item.dueDate ? formatDateTime(item.dueDate) : undefined}
                  >
                    {formatDueDate(item.dueDate)}
                  </span>
                </DetailRow>
                <DetailRow label="Team">
                  <span>
                    {item.team.key} · {item.team.name}
                  </span>
                </DetailRow>
                <DetailRow label="Created">
                  <span className="text-muted-foreground" title={formatDateTime(item.createdAt)}>
                    {formatDate(item.createdAt)}
                  </span>
                </DetailRow>
                <DetailRow label="Updated">
                  <span className="text-muted-foreground" title={formatDateTime(item.updatedAt)}>
                    {formatDate(item.updatedAt)}
                  </span>
                </DetailRow>
                {item.resolvedAt ? (
                  <DetailRow label="Resolved">
                    <span className="text-muted-foreground">{formatDate(item.resolvedAt)}</span>
                  </DetailRow>
                ) : null}
                <Separator />
                <DetailRow label="Revision">
                  <span className="text-muted-foreground">v{item.version}</span>
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity</CardTitle>
              <CardDescription>
                {activityTotal} recorded {pluralize(activityTotal, "event")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <ActivityTimeline events={activity} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 max-w-[64%] justify-end text-right text-xs font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}
