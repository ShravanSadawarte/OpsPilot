import { db } from "@/lib/db";
import {
  ErrorCode,
  AppError,
  ok,
  err,
} from "@/lib/http";
import {
  validateInput,
  CreateWorkItemSchema,
  UpdateWorkItemSchema,
  TransitionWorkItemSchema,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
  type TransitionWorkItemInput,
} from "@/lib/validation";
import {
  requireUser,
  getCsrfTokenFromCookie,
} from "@/lib/auth";
import {
  canCreateWorkItem,
  canEditWorkItem,
  canViewWorkItem,
  canAssignWorkItem,
  canTransitionWorkItem,
  canRequestApproval,
  getUserTeamIds,
  isTeamMember,
  type AuthedUser,
} from "@/lib/permissions";
import { isValidTransition } from "@/lib/workflow";
import { WorkItemStatus, WorkItemType, Priority, Prisma } from "@prisma/client";

/** Compute a stable fingerprint of a request payload for idempotency. */
function fingerprintOf(payload: unknown): string {
  const canonical = JSON.stringify(payload);
  // Avoid importing node:crypto twice; use a simple stable hash is not
  // cryptographically strong but sufficient as a request fingerprint.
  // We use the Web Crypto API subtle digest available in Next.js server.
  // For server-side determinism use a lightweight approach:
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `${canonical.length}:${hash}`;
}

/** Build the human-readable description for an activity event. */
function activityDescription(
  type: string,
  meta?: Record<string, unknown>,
): string {
  switch (type) {
    case "CREATED":
      return "Work item created";
    case "UPDATED":
      return `Work item updated${meta?.fields ? ` (${String(meta.fields)})` : ""}`;
    case "STATUS_CHANGED":
      return `Status changed to ${meta?.nextStatus ?? "?"}${
        meta?.previousStatus ? ` from ${meta.previousStatus}` : ""
      }`;
    case "PRIORITY_CHANGED":
      return `Priority changed to ${meta?.nextPriority ?? "?"}${
        meta?.previousPriority ? ` from ${meta.previousPriority}` : ""
      }`;
    case "ASSIGNED":
      return `Assigned to ${meta?.assigneeName ?? "a user"}`;
    case "UNASSIGNED":
      return "Assignment removed";
    case "COMMENT_ADDED":
      return "Comment added";
    case "APPROVAL_REQUESTED":
      return "Approval requested";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return `Rejected${meta?.reason ? `: ${meta.reason}` : ""}`;
    default:
      return type;
  }
}

/* ======================================================================== */
/* List / get                                                               */
/* ======================================================================== */

export interface WorkItemFilters {
  teamId?: string;
  status?: WorkItemStatus;
  priority?: Priority;
  type?: WorkItemType;
  assigneeId?: string;
  reporterId?: string;
  search?: string;
  dueDate?: string; // ISO
  overdue?: "true" | "false";
}

export async function listWorkItems({
  user,
  filters,
  pagination,
}: {
  user: AuthedUser;
  filters: WorkItemFilters;
  pagination: { page: number; pageSize: number; sort?: string; order?: "asc" | "desc" };
}) {
  const teamIds = await getUserTeamIds(user.id);
  if (teamIds.length === 0) {
    return ok({ items: [], meta: { page: pagination.page, pageSize: pagination.pageSize, total: 0, totalPages: 0 } });
  }

  // Cross-team leakage filter: only teams the user can see.
  const teamFilter = filters.teamId ? [filters.teamId] : teamIds;
  const unauthorizedTeam = filters.teamId && !teamIds.includes(filters.teamId);
  if (unauthorizedTeam) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team not found.");
  }

  const where: Prisma.WorkItemWhereInput = {
    teamId: { in: teamFilter },
  };

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.type) where.type = filters.type;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.reporterId) where.reporterId = filters.reporterId;
  if (filters.dueDate) {
    where.dueDate = { gte: new Date(filters.dueDate) };
  }
  if (filters.overdue === "true") {
    where.dueDate = { lt: new Date() };
    where.status = { notIn: [WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED] };
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { publicKey: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.workItem.findMany({
      where,
      include: {
        team: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
      orderBy: [
        { [pagination.sort ?? "updatedAt"]: pagination.order ?? "desc" },
        { createdAt: "desc" },
      ],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    db.workItem.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pagination.pageSize);
  return ok({
    items,
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
    },
  });
}

export async function getWorkItem(user: AuthedUser, workItemId: string) {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    include: {
      team: { select: { id: true, key: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  });

  if (!item) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: item.teamId });
  if (!allowed) {
    // 404 to avoid leaking existence across teams
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  return ok(item);
}

/* ======================================================================== */
/* Create (idempotent)                                                      */
/* ======================================================================== */

export async function createWorkItem(
  user: AuthedUser,
  input: CreateWorkItemInput,
  idempotencyKey?: string,
  idempotencyFingerprint?: string,
) {
  // Authorization
  const allowed = await canCreateWorkItem(user, input.teamId);
  if (!allowed) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot create work items in this team.");
  }

  // Validate target is active team
  const team = await db.team.findUnique({ where: { id: input.teamId } });
  if (!team || !team.isActive) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team not found.");
  }

  // Idempotency: check existing record scoped to actor + key
  if (idempotencyKey) {
    const existing = await db.idempotencyRecord.findUnique({
      where: { actorId_key: { actorId: user.id, key: idempotencyKey } },
    });
    if (existing) {
      const storedFingerprint = existing.fingerprint as string;
      if (storedFingerprint !== idempotencyFingerprint) {
        throw new AppError(
          409,
          ErrorCode.IDEMPOTENCY_CONFLICT,
          "Idempotency key reused with a different payload.",
        );
      }
      // Identical retry: return the original stored result.
      return ok(existing.body as unknown, { status: 200 });
    }
  }

  const result = await db.$transaction(async (tx) => {
    // Allocate public key concurrency-safely via PostgreSQL sequence.
    const seq = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('workitem_public_key_seq') AS nextval`,
    );
    const publicKey = `OPS-${Number(seq[0]?.nextval ?? 1001)}`;

    const workItem = await tx.workItem.create({
      data: {
        publicKey,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        priority: input.priority,
        teamId: input.teamId,
        assigneeId: input.assigneeId ?? null,
        reporterId: user.id,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        version: 1,
      },
      include: {
        team: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    // Transactional audit event: committed only if the mutation commits.
    await tx.activityEvent.create({
      data: {
        workItemId: workItem.id,
        actorId: user.id,
        type: "CREATED",
        metadata: { publicKey, title: workItem.title },
      },
    });

    return workItem;
  });

  // Persist idempotency record for the successful result.
  if (idempotencyKey) {
    await db.idempotencyRecord.create({
      data: {
        actorId: user.id,
        key: idempotencyKey,
        fingerprint: idempotencyFingerprint ?? fingerprintOf(input),
        statusCode: 201,
        body: { workItemId: result.id, publicKey: result.publicKey } as Prisma.InputJsonValue,
      },
    });
  }

  return ok(result, { status: 201 });
}

/* ======================================================================== */
/* Update (optimistic concurrency)                                          */
/* ======================================================================== */

export async function updateWorkItem(
  user: AuthedUser,
  workItemId: string,
  input: UpdateWorkItemInput,
) {
  const existing = await db.workItem.findUnique({
    where: { id: workItemId },
  });
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: existing.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const canEdit = await canEditWorkItem(user, {
    teamId: existing.teamId,
    reporterId: existing.reporterId,
    assigneeId: existing.assigneeId,
  });
  if (!canEdit) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot edit this work item.");
  }

  const expectedVersion = input.version;
  const data: Prisma.WorkItemUpdateInput = {};
  const changedFields: string[] = [];

  if (input.title !== undefined && input.title !== existing.title) {
    data.title = input.title;
    changedFields.push("title");
  }
  if (input.description !== undefined && input.description !== existing.description) {
    data.description = input.description ?? null;
    changedFields.push("description");
  }
  if (input.type !== undefined && input.type !== existing.type) {
    data.type = input.type;
    changedFields.push("type");
  }
  if (input.priority !== undefined && input.priority !== existing.priority) {
    data.priority = input.priority;
    changedFields.push("priority");
  }
  if (input.status !== undefined && input.status !== existing.status) {
    data.status = input.status;
    changedFields.push("status");
  }
  if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
    data.assignee = input.assigneeId
      ? { connect: { id: input.assigneeId } }
      : { disconnect: true };
    changedFields.push("assignee");
  }
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    changedFields.push("dueDate");
  }

  if (changedFields.length === 0) {
    // Nothing to change; still re-fetch and return current.
    return ok(await getWorkItemFresh(user, workItemId));
  }

  data.version = { increment: 1 };

  try {
    const updated = await db.workItem.update({
      where: { id: workItemId, version: expectedVersion }, // atomic conditional update
      data,
      include: {
        team: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({ workItemId, actorId: user.id, type: "UPDATED", meta: { fields: changedFields.join(", ") } });
    return ok(updated);
  } catch (e: any) {
    // Prisma P2025: record not found -> version mismatch -> conflict
    if (e?.code === "P2025") {
      throw new AppError(
        409,
        ErrorCode.VERSION_CONFLICT,
        "This work item was updated by another user. Refresh and reapply your changes.",
        { version: [String(expectedVersion)] },
      );
    }
    throw e;
  }
}

/* ======================================================================== */
/* Transition                                                               */
/* ======================================================================== */

export async function transitionWorkItem(
  user: AuthedUser,
  workItemId: string,
  input: TransitionWorkItemInput,
) {
  const existing = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { team: true },
  });
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: existing.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const canTrans = await canTransitionWorkItem(user, {
    teamId: existing.teamId,
    status: existing.status,
  }, input.status);
  if (!canTrans) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot transition this work item.");
  }

  if (!isValidTransition(existing.status, input.status)) {
    throw new AppError(
      400,
      ErrorCode.WORKFLOW_TRANSITION_INVALID,
      `Invalid transition from ${existing.status} to ${input.status}.`,
      {
        from: [existing.status],
        to: [input.status],
      },
    );
  }

  try {
    const updated = await db.workItem.update({
      where: { id: workItemId, version: input.version },
      data: {
        status: input.status,
        version: { increment: 1 },
        ...(input.status === WorkItemStatus.RESOLVED && !existing.resolvedAt
          ? { resolvedAt: new Date() }
          : input.status !== WorkItemStatus.RESOLVED
            ? { resolvedAt: null }
            : {}),
      },
      include: {
        team: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      workItemId,
      actorId: user.id,
      type: "STATUS_CHANGED",
      meta: { previousStatus: existing.status, nextStatus: input.status },
    });

    if (input.status === WorkItemStatus.RESOLVED && !existing.resolvedAt) {
      await logActivity({
        workItemId,
        actorId: user.id,
        type: "UPDATED",
        meta: { fields: "resolvedAt" },
      });
    }

    return ok(updated);
  } catch (e: any) {
    if (e?.code === "P2025") {
      throw new AppError(
        409,
        ErrorCode.VERSION_CONFLICT,
        "This work item was updated by another user. Refresh and reapply your changes.",
      );
    }
    throw e;
  }
}

/* ======================================================================== */
/* Assign / claim (atomic)                                                  */
/* ======================================================================== */

export async function assignWorkItem(
  user: AuthedUser,
  workItemId: string,
  { assigneeId, expectedVersion }: { assigneeId: string | null; expectedVersion: number },
) {
  const existing = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { team: true },
  });
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: existing.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  // Validate target membership + active status
  if (assigneeId) {
    const canAssign = await canAssignWorkItem(user, { teamId: existing.teamId }, assigneeId);
    if (!canAssign) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Target user is not an active member of this team or you cannot assign.",
      );
    }
  }

  try {
    const updated = await db.workItem.update({
      where: { id: workItemId, version: expectedVersion },
      data: {
        assignee: assigneeId ? { connect: { id: assigneeId } } : { disconnect: true },
        version: { increment: 1 },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, key: true, name: true } },
      },
    });

    await logActivity({
      workItemId,
      actorId: user.id,
      type: assigneeId ? "ASSIGNED" : "UNASSIGNED",
      meta: assigneeId ? { assigneeName: (updated.assignee as any)?.name ?? assigneeId } : {},
    });

    return ok(updated);
  } catch (e: any) {
    if (e?.code === "P2025") {
      throw new AppError(409, ErrorCode.VERSION_CONFLICT, "Stale assignment attempt.");
    }
    throw e;
  }
}

/** Exclusive claim: claim an unassigned work item atomically. */
export async function claimWorkItem(
  user: AuthedUser,
  workItemId: string,
  expectedVersion: number,
) {
  const existing = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { team: true },
  });
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: existing.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  if (existing.assigneeId) {
    throw new AppError(409, ErrorCode.CONFLICT, "Work item is already assigned.");
  }

  // Claim only if still unassigned (atomic conditional update on assigneeId null + version)
  try {
    const updated = await db.workItem.update({
      where: {
        id: workItemId,
        version: expectedVersion,
        assigneeId: null, // atomic: only succeeds if still unassigned
      },
      data: {
        assignee: { connect: { id: user.id } },
        version: { increment: 1 },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, key: true, name: true } },
      },
    });

    await logActivity({
      workItemId,
      actorId: user.id,
      type: "ASSIGNED",
      meta: { assigneeName: user.email },
    });

    return ok(updated);
  } catch (e: any) {
    if (e?.code === "P2025") {
      // Either version mismatch or already assigned by someone else
      const current = await db.workItem.findUnique({ where: { id: workItemId } });
      if (current?.assigneeId) {
        throw new AppError(409, ErrorCode.CONFLICT, "Work item was claimed by another user.");
      }
      throw new AppError(409, ErrorCode.VERSION_CONFLICT, "Stale claim attempt.");
    }
    throw e;
  }
}

/* ======================================================================== */
/* Comments                                                                 */
/* ======================================================================== */

export async function addComment(
  user: AuthedUser,
  workItemId: string,
  { body }: { body: string },
) {
  const existing = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { team: true },
  });
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const allowed = await canViewWorkItem(user, { teamId: existing.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const comment = await db.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: { workItemId, authorId: user.id, body },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    await tx.activityEvent.create({
      data: {
        workItemId,
        actorId: user.id,
        type: "COMMENT_ADDED",
        metadata: { commentId: c.id },
      },
    });
    return c;
  });

  return ok(comment, { status: 201 });
}

/* ======================================================================== */
/* Activity                                                                 */
/* ======================================================================== */

export async function listActivity({
  user,
  workItemId,
  pagination,
}: {
  user: AuthedUser;
  workItemId: string;
  pagination: { page: number; pageSize: number };
}) {
  const item = await db.workItem.findUnique({ where: { id: workItemId } });
  if (!item) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }
  const allowed = await canViewWorkItem(user, { teamId: item.teamId });
  if (!allowed) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }

  const [events, total] = await Promise.all([
    db.activityEvent.findMany({
      where: { workItemId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    db.activityEvent.count({ where: { workItemId } }),
  ]);

  return ok({
    items: events.map((e) => ({
      ...e,
      actor: e.actor ?? null,
    })),
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  });
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

async function getWorkItemFresh(user: AuthedUser, workItemId: string) {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    include: {
      team: { select: { id: true, key: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  });
  if (!item) throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  if (!(await canViewWorkItem(user, { teamId: item.teamId }))) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Work item not found.");
  }
  return ok(item);
}

export async function logActivity(args: {
  workItemId: string;
  actorId: string;
  type: string;
  meta?: Record<string, unknown>;
}) {
  await db.activityEvent.create({
    data: {
      workItemId: args.workItemId,
      actorId: args.actorId,
      type: args.type as any,
      metadata: (args.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}
