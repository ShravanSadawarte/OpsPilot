import { db } from "@/lib/db";
import { AppError, ErrorCode, ok } from "@/lib/http";
import {
  canRequestApproval,
  canDecideApproval,
  canViewWorkItem,
  getUserTeamIds,
  type AuthedUser,
} from "@/lib/permissions";
import { ApprovalStatus } from "@prisma/client";

export async function requestApproval(
  user: AuthedUser,
  { workItemId }: { workItemId: string },
) {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { team: true },
  });
  if (!item) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: item.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const canRequest = await canRequestApproval(user, {
    teamId: item.teamId,
    reporterId: item.reporterId,
  });
  if (!canRequest) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot request approval for this item.");
  }

  // Only one pending approval per work item.
  const existing = await db.approval.findFirst({
    where: { workItemId, status: ApprovalStatus.PENDING },
  });
  if (existing) {
    throw new AppError(409, ErrorCode.CONFLICT, "A pending approval already exists for this work item.");
  }

  const approval = await db.$transaction(async (tx) => {
    const a = await tx.approval.create({
      data: { workItemId, requestedById: user.id, status: ApprovalStatus.PENDING },
      include: { requestedBy: { select: { id: true, name: true, email: true } } },
    });
    await tx.activityEvent.create({
      data: {
        workItemId,
        actorId: user.id,
        type: "APPROVAL_REQUESTED",
        metadata: { approvalId: a.id },
      },
    });
    return a;
  });

  return ok(approval, { status: 201 });
}

export async function listPendingApprovals(user: AuthedUser) {
  const ids = await getUserTeamIds(user.id);

  const approvals = await db.approval.findMany({
    where: {
      status: ApprovalStatus.PENDING,
      workItem: { teamId: { in: ids } },
    },
    include: {
      workItem: { select: { id: true, publicKey: true, title: true, status: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(approvals);
}

export async function decideApproval(
  user: AuthedUser,
  approvalId: string,
  { status, reason }: { status: "APPROVED" | "REJECTED"; reason?: string },
) {
  if (status === "REJECTED" && (!reason || reason.trim().length === 0)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "A reason is required for rejection.", {
      reason: ["A reason is required for rejection."],
    });
  }

  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    include: { workItem: { include: { team: true } }, requestedBy: true },
  });
  if (!approval) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Approval not found.");
  }

  if (approval.status !== ApprovalStatus.PENDING) {
    throw new AppError(409, ErrorCode.CONFLICT, "This approval has already been decided.");
  }

  const canDecide = await canDecideApproval(user, {
    workItem: { teamId: approval.workItem.teamId },
    requestedById: approval.requestedById,
  });
  if (!canDecide) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot decide this approval.");
  }

  // Atomic conditional decision: only one concurrent decision succeeds.
  const decided = await db.approval.update({
    where: { id: approvalId, status: ApprovalStatus.PENDING },
    data: {
      status: status === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      decidedById: user.id,
      decidedAt: new Date(),
      reason: status === "REJECTED" ? reason : null,
    },
  });

  if (!decided) {
    // Another request beat us to it.
    throw new AppError(409, ErrorCode.CONFLICT, "This approval was already decided by another user.");
  }

  // Optionally transition work item status on approval/reject within same tx.
  // We do it after the conditional update commits by re-checking state.
  const workItem = await db.workItem.findUnique({ where: { id: approval.workItemId } });

  return ok({
    approval: decided,
    workItem,
  });
}

export async function getApproval(user: AuthedUser, approvalId: string) {
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    include: {
      workItem: { select: { id: true, publicKey: true, title: true, teamId: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!approval) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Approval not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: approval.workItem.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Approval not found.");
  }

  return ok(approval);
}
