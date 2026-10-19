import { db } from "@/lib/db";
import { AppError, ErrorCode, ok } from "@/lib/http";
import { validateInput, TeamSchema, type TeamInput } from "@/lib/validation";
import {
  canManageTeam,
  isTeamMember,
  type AuthedUser,
} from "@/lib/permissions";
import { UserRole } from "@prisma/client";

export async function listTeams(user: AuthedUser) {
  const teams = await db.team.findMany({
    where: { isActive: true },
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

  const items = team.memberships.map((m) => ({
    id: m.id,
    user: m.user,
    role: m.role,
  }));

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

  const team = await db.team.create({
    data: { key: data.key, name: data.name, description: data.description ?? null },
  });

  // Auto-add the creator as a team lead member.
  await db.teamMembership.create({
    data: { teamId: team.id, userId: user.id, role: "TEAM_LEAD" },
  });

  return ok(team, { status: 201 });
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

  if (input.key) {
    const data = validateInput(TeamSchema, { key: input.key, name: team.name });
    if (data.key !== team.key) {
      const clash = await db.team.findUnique({ where: { key: data.key } });
      if (clash) {
        throw new AppError(409, ErrorCode.CONFLICT, "A team with this key already exists.");
      }
    }
  }

  const updated = await db.team.update({
    where: { id: teamId },
    data: {
      ...(input.key !== undefined ? { key: input.key } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
  return ok(updated);
}

export async function addTeamMember(
  user: AuthedUser,
  teamId: string,
  { userId, role }: { userId: string; role: string },
) {
  const canManage = await canManageTeam(user, teamId);
  if (!canManage) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Cannot manage this team.");
  }

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || !target.isActive) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "User not found.");
  }

  const membership = await db.teamMembership.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: { role: role as UserRole, isActive: true },
    create: { teamId, userId, role: role as UserRole },
  });

  return ok(membership);
}

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
