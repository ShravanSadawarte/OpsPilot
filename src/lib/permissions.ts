import { db } from "./db";
import { UserRole, WorkItemStatus } from "@prisma/client";

/**
 * Authorization model:
 *
 * Global roles (User.role):
 *   ADMIN      - full access across all teams and work items.
 *   MANAGER    - can manage teams, members, approve work items cross-team (within scope), create work items.
 *   MEMBER     - baseline authenticated user; scoped by team membership.
 *   TEAM_LEAD  - team-specific leadership role; manages their team(s).
 *   TEAM_MEMBER - team-specific member role; works within their team(s).
 *
 * TeamMembership.role is the team-specific role. A user's effective authority
 * within a team = max(global role weight, team membership role weight).
 *
 * Every API endpoint authenticates the user and authorizes access to the
 * specific resource at the server boundary. Client-supplied ids/roles are
 * never trusted.
 */

// Role weight used for "effective role" comparisons.
export function roleWeight(role: UserRole): number {
  switch (role) {
    case UserRole.ADMIN: return 100;
    case UserRole.MANAGER: return 80;
    case UserRole.TEAM_LEAD: return 60;
    case UserRole.MEMBER: return 40;
    case UserRole.TEAM_MEMBER: return 30;
    default: return 0;
  }
}

export interface AuthedUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

/** Resource-disclosure policy:
 *  - 404 when the caller must not learn whether the resource exists (cross-team
 *    leakage protection for list/read by default).
 *  - 403 when the resource exists but the caller is not permitted to act on it.
 *  Endpoints choose per the documented policy below:
 *    * GET /work-items/:id  -> 404 if not on a team the user can see (no leak)
 *    * mutations on a work item the user can see but can't modify -> 403
 */

interface TeamMembershipWithUser {
  id: string;
  teamId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
}

/** Load the active memberships for a user (teams they belong to). */
export async function getUserMemberships(userId: string): Promise<TeamMembershipWithUser[]> {
  return db.teamMembership.findMany({
    where: { userId, isActive: true },
    include: { team: true },
  });
}

/** The teams a user can see/act within (active memberships). */
export async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await getUserMemberships(userId);
  return memberships.map((m) => m.teamId);
}

/** The user's effective role within a specific team (global vs team role). */
export async function getEffectiveRole(
  user: AuthedUser,
  teamId: string,
): Promise<{ role: UserRole; membership: TeamMembershipWithUser | null }> {
  // ADMIN/MANAGER have global authority regardless of membership.
  if (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) {
    return { role: user.role, membership: null };
  }
  const memberships = await getUserMemberships(user.id);
  const m = memberships.find((x) => x.teamId === teamId);
  if (!m) {
    return { role: UserRole.MEMBER, membership: null }; // no standing in team
  }
  // Effective role = heavier of global role and team membership role.
  return roleWeight(m.role) >= roleWeight(user.role)
    ? { role: m.role, membership: m }
    : { role: user.role, membership: m };
}

/* ------------------------------------------------------------------ */
/* Work-item permissions                                              */
/* ------------------------------------------------------------------ */

/** Can the user view this work item? */
export async function canViewWorkItem(
  user: AuthedUser,
  item: { teamId: string },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  const teamIds = await getUserTeamIds(user.id);
  return teamIds.includes(item.teamId);
}

/** Can the user create a work item in a team? */
export async function canCreateWorkItem(
  user: AuthedUser,
  teamId: string,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;
  const { role } = await getEffectiveRole(user, teamId);
  return (
    role === UserRole.TEAM_LEAD ||
    role === UserRole.MANAGER ||
    role === UserRole.TEAM_MEMBER ||
    role === UserRole.MEMBER
  );
}

/** Can the user edit permitted fields of this work item? */
export async function canEditWorkItem(
  user: AuthedUser,
  item: { teamId: string; reporterId: string; assigneeId: string | null },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;

  const { role, membership } = await getEffectiveRole(user, item.teamId);
  const isMember = !!membership;

  // Reporter can edit their own item while open/in progress.
  if (isMember && item.reporterId === user.id) {
    return (
      role === UserRole.TEAM_LEAD ||
      role === UserRole.TEAM_MEMBER ||
      role === UserRole.MANAGER ||
      role === UserRole.MEMBER
    );
  }
  // Assignee can edit their assigned item.
  if (isMember && item.assigneeId === user.id) {
    return true;
  }
  // Team lead can edit items within their team.
  if (role === UserRole.TEAM_LEAD) return true;
  return false;
}

/** Can the user assign/reassign this work item to a target user? */
export async function canAssignWorkItem(
  user: AuthedUser,
  item: { teamId: string },
  targetUserId: string,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;
  const { role } = await getEffectiveRole(user, item.teamId);
  if (role !== UserRole.TEAM_LEAD) return false;
  // Target must be an active member of the same team.
  const targetMembership = await db.teamMembership.findFirst({
    where: { userId: targetUserId, teamId: item.teamId, isActive: true },
  });
  return !!targetMembership;
}

/** Can the user transition this work item to the next status? */
export async function canTransitionWorkItem(
  user: AuthedUser,
  item: { teamId: string; status: WorkItemStatus },
  nextStatus: WorkItemStatus,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;
  const { role } = await getEffectiveRole(user, item.teamId);
  // Team leads and managers can drive workflow; members can advance items they
  // are assigned to or reported (handled at service layer with state checks).
  return (
    role === UserRole.TEAM_LEAD ||
    role === UserRole.MANAGER ||
    role === UserRole.ADMIN
  );
}

/** Can the user manage a team (membership, settings)? */
export async function canManageTeam(user: AuthedUser, teamId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;
  const { role } = await getEffectiveRole(user, teamId);
  return role === UserRole.TEAM_LEAD;
}

/** Can the user request an approval for this work item? */
export async function canRequestApproval(
  user: AuthedUser,
  item: { teamId: string; reporterId: string },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;
  const { role } = await getEffectiveRole(user, item.teamId);
  // Reporter or team lead may request approval.
  return (
    (role === UserRole.TEAM_LEAD || role === UserRole.MANAGER) ||
    item.reporterId === user.id
  );
}

/** Can the user decide (approve/reject) a pending approval? */
export async function canDecideApproval(
  user: AuthedUser,
  approval: { workItem: { teamId: string }; requestedById: string },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MANAGER) return true;
  // Cannot decide your own request.
  if (approval.requestedById === user.id) return false;
  const { role } = await getEffectiveRole(user, approval.workItem.teamId);
  return role === UserRole.TEAM_LEAD || role === UserRole.MANAGER;
}

/** Is the user an active member of the given team? */
export async function isTeamMember(user: AuthedUser, teamId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  const membership = await db.teamMembership.findFirst({
    where: { userId: user.id, teamId, isActive: true },
  });
  return !!membership;
}
