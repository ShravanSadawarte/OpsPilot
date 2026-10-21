import { db } from "@/lib/db";
import { AppError, ErrorCode, ok } from "@/lib/http";
import { validateInput, TeamSchema, type TeamInput } from "@/lib/validation";
import {
  canManageTeam,
  getEffectiveRole,
  getVisibleTeamIds,
  isTeamMember,
  isTeamMembershipRole,
  resolveEffectiveRole,
  roleWeight,
  type AuthedUser,
  type TeamMembershipRole,
} from "@/lib/permissions";
import { UserRole } from "@prisma/client";

export async function listTeams(user: AuthedUser) {
  const visibleTeamIds = await getVisibleTeamIds(user);
  if (visibleTeamIds.length === 0) {
    return ok({ items: [] });
  }

  const teams = await db.team.findMany({
    where: { isActive: true, id: { in: visibleTeamIds } },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          memberships: { where: { isActive: true } },
          workItems: true,
        },
      },
    },
    orderBy: { key: "asc" },
  });

  // Enrich with membership info for the current user.
  const memberships = await db.teamMembership.findMany({
    where: { userId: user.id, isActive: true },
    select: { teamId: true, role: true },
  });
  const membershipByTeam = new Map(memberships.map((m) => [m.teamId, m.role]));

  const items = teams.map((t) => {
    const { _count, ...rest } = t;
    return {
      ...rest,
      memberCount: _count.memberships,
      workItemCount: _count.workItems,
      userRole: membershipByTeam.get(t.id) ?? null,
    };
  });

  return ok({ items });
}

export async function getTeam(user: AuthedUser, teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      memberships: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { workItems: true, memberships: { where: { isActive: true } } } },
    },
  });
  if (!team) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team not found.");
  }

  // Cross-team disclosure: only members/admins/managers may view details.
  const canManage = await canManageTeam(user, teamId);
  const isMember = await isTeamMember(user, teamId);
  if (!canManage && !isMember) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team not found.");
  }

  const actor = await getEffectiveRole(user, teamId);
  const items = team.memberships.map((m) => {
    const targetRole = resolveEffectiveRole(m.user.role, m.role);
    return {
      id: m.id,
      user: m.user,
      role: m.role,
      canRemove:
        canManage &&
        m.userId !== user.id &&
        (user.role === UserRole.ADMIN ||
          (targetRole !== UserRole.ADMIN &&
            roleWeight(targetRole) < roleWeight(actor.role))),
    };
  });

  return ok({
    team: {
      id: team.id,
      key: team.key,
      name: team.name,
      description: team.description,
      isActive: team.isActive,
      createdAt: team.createdAt,
      workItemCount: team._count.workItems,
      memberCount: team._count.memberships,
      memberships: items,
    },
  });
}

export async function createTeam(user: AuthedUser, input: TeamInput) {
  const data = validateInput(TeamSchema, input);

  // createTeam is admin/manager only (no existing team yet).
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Only administrators and managers can create teams.");
  }

  const existing = await db.team.findUnique({ where: { key: data.key } });
  if (existing) {
    throw new AppError(409, ErrorCode.CONFLICT, "A team with this key already exists.");
  }

  try {
    const team = await db.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: { key: data.key, name: data.name, description: data.description ?? null },
      });

      // Auto-add the creator as a team lead member in the same transaction so a
      // team can never be orphaned from the manager who created it.
      await tx.teamMembership.create({
        data: { teamId: created.id, userId: user.id, role: "TEAM_LEAD" },
      });

      return created;
    });

    return ok(team, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new AppError(409, ErrorCode.CONFLICT, "A team with this key already exists.");
    }
    throw error;
  }
}

export async function updateTeam(
  user: AuthedUser,
  teamId: string,
  input: Partial<TeamInput>,
) {
  const canManage = await canManageTeam(user, teamId);
  if (!canManage) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot manage this team.");
  }

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team not found.");
  }

  // Validate the merged record so a name/description-only update is checked
  // just as strictly as a key change.
  const data = validateInput(TeamSchema, {
    key: input.key ?? team.key,
    name: input.name ?? team.name,
    description: input.description ?? team.description ?? undefined,
  });

  if (data.key !== team.key) {
    const clash = await db.team.findUnique({ where: { key: data.key } });
    if (clash) {
      throw new AppError(409, ErrorCode.CONFLICT, "A team with this key already exists.");
    }
  }

  const updated = await db.team.update({
    where: { id: teamId },
    data: {
      key: data.key,
      name: data.name,
      description: data.description ?? null,
    },
  });
  return ok(updated);
}

/**
 * Add or update a team membership.
 *
 * This is a role-assignment operation as well as a membership operation, so it
 * is restricted to global administrators and managers. A team lead can manage
 * the existing roster (remove members) but cannot grant team roles. The role
 * schema only accepts team-scoped roles, so an ADMIN/MANAGER global identity
 * cannot be minted through a team membership request.
 */
export async function addTeamMember(
  user: AuthedUser,
  teamId: string,
  { userId, role }: { userId: string; role: TeamMembershipRole },
) {
  // Defense in depth for direct service callers: never persist a global role
  // on a team membership, even if the route schema is refactored later.
  if (!isTeamMembershipRole(role as UserRole)) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      "Team roles must be TEAM_LEAD, TEAM_MEMBER, or MEMBER.",
    );
  }

  const canManage = await canManageTeam(user, teamId);
  if (!canManage) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot manage this team.");
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new AppError(
      403,
      ErrorCode.FORBIDDEN,
      "Only administrators and managers can assign team roles.",
    );
  }

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || !target.isActive) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "User not found.");
  }

  const membership = await db.teamMembership.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: { role, isActive: true },
    create: { teamId, userId, role },
  });

  return ok(membership);
}

/**
 * Deactivate a team membership.
 *
 * Team leads and managers may remove ordinary members. They cannot remove
 * themselves, a platform administrator, or someone whose effective authority
 * (global or team role) is equal/higher than their own. A platform ADMIN is
 * the only role that bypasses this hierarchy.
 */
export async function removeTeamMember(
  user: AuthedUser,
  teamId: string,
  userId: string,
) {
  const canManage = await canManageTeam(user, teamId);
  if (!canManage) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot manage this team.");
  }

  if (userId === user.id) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "You cannot remove yourself from a team.");
  }

  const membership = await db.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { user: { select: { id: true, role: true, isActive: true } } },
  });
  if (!membership || !membership.isActive) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team member not found.");
  }

  if (user.role !== UserRole.ADMIN) {
    const actor = await getEffectiveRole(user, teamId);
    const targetRole = resolveEffectiveRole(membership.user.role, membership.role);

    if (targetRole === UserRole.ADMIN) {
      throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot remove a platform administrator.");
    }
    if (roleWeight(targetRole) >= roleWeight(actor.role)) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Cannot remove a member with equal or higher team authority.",
      );
    }
  }

  await db.teamMembership.update({
    where: { teamId_userId: { teamId, userId } },
    data: { isActive: false },
  });

  return ok({ ok: true });
}

/** Team-scoped work overview / metrics. */
export async function teamWorkOverview(user: AuthedUser, teamId: string) {
  const canManage = await canManageTeam(user, teamId);
  const isMember = await isTeamMember(user, teamId);
  if (!canManage && !isMember) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Team not found.");
  }

  const [total, byStatus, byPriority, recent] = await Promise.all([
    db.workItem.count({ where: { teamId } }),
    db.workItem.groupBy({
      by: ["status"],
      where: { teamId },
      _count: { status: true },
    }),
    db.workItem.groupBy({
      by: ["priority"],
      where: { teamId },
      _count: { priority: true },
    }),
    db.workItem.findMany({
      where: { teamId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, publicKey: true, title: true, status: true, priority: true, updatedAt: true },
    }),
  ]);

  return ok({
    teamId,
    total,
    byStatus: byStatus.map((b) => ({ status: b.status, count: b._count.status })),
    byPriority: byPriority.map((b) => ({ priority: b.priority, count: b._count.priority })),
    recent,
  });
}
