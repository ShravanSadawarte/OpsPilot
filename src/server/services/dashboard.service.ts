import { db } from "@/lib/db";
import { AppError, ErrorCode, ok } from "@/lib/http";
import {
  canViewWorkItem,
  getUserTeamIds,
  type AuthedUser,
} from "@/lib/permissions";
import { WorkItemStatus, Priority } from "@prisma/client";

export async function dashboardMetrics(user: AuthedUser) {
  const teamIds = await getUserTeamIds(user.id);

  if (teamIds.length === 0) {
    return ok({
      openWork: 0,
      criticalHighWork: 0,
      overdueWork: 0,
      unassignedWork: 0,
      myWork: 0,
      pendingApprovals: 0,
      recentActivity: [],
      statusSummary: [],
      prioritySummary: [],
      attentionRequired: [],
    });
  }

  const now = new Date();

  // Base scope: teams the user can see (global roles see everything via teamIds
  // = all active teams for admin/manager? getUserTeamIds returns memberships,
  // so admin without memberships sees none. That's a documented choice:
  // dashboard is team-scoped by membership; admins see teams they're members of.
  // To make admin see everything, we'd query all teams. We keep membership scope.)

  const baseWhere = { teamId: { in: teamIds } };

  const [
    openWork,
    criticalHighWork,
    overdueWork,
    unassignedWork,
    myWork,
    pendingApprovals,
    statusSummary,
    prioritySummary,
    recentActivity,
  ] = await Promise.all([
    db.workItem.count({
      where: { ...baseWhere, status: { notIn: [WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED] } },
    }),
    db.workItem.count({
      where: {
        ...baseWhere,
        priority: { in: [Priority.HIGH, Priority.CRITICAL] },
        status: { notIn: [WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED] },
      },
    }),
    db.workItem.count({
      where: {
        ...baseWhere,
        dueDate: { lt: now },
        status: { notIn: [WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED] },
      },
    }),
    db.workItem.count({ where: { ...baseWhere, assigneeId: null } }),
    db.workItem.count({ where: { ...baseWhere, assigneeId: user.id } }),
    db.approval.count({
      where: { status: "PENDING", workItem: { teamId: { in: teamIds } } },
    }),
    db.workItem.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { status: true },
    }),
    db.workItem.groupBy({
      by: ["priority"],
      where: baseWhere,
      _count: { priority: true },
    }),
    db.activityEvent.findMany({
      where: { workItem: { teamId: { in: teamIds } } },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        workItem: { select: { id: true, publicKey: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Attention-required: open, unassigned, or overdue items the user can see.
  const attentionRequired = await db.workItem.findMany({
    where: {
      ...baseWhere,
      status: { notIn: [WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED] },
      OR: [
        { assigneeId: null },
        { dueDate: { lt: now } },
        { priority: Priority.CRITICAL },
      ],
    },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
    take: 10,
    select: {
      id: true,
      publicKey: true,
      title: true,
      status: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
    },
  });

  return ok({
    openWork,
    criticalHighWork,
    overdueWork,
    unassignedWork,
    myWork,
    pendingApprovals,
    recentActivity: recentActivity.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      actor: e.actor ?? null,
      workItem: e.workItem,
    })),
    statusSummary: statusSummary.map((s) => ({ status: s.status, count: s._count.status })),
    prioritySummary: prioritySummary.map((p) => ({ priority: p.priority, count: p._count.priority })),
    attentionRequired,
  });
}
