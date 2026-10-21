import { db } from "./db";
import { UserRole } from "@prisma/client";

/**
 * OpsPilot authorization model
 * ============================
 *
 * There is no organization tenant in the current schema. The security boundary
 * is the team, plus an explicit platform-wide ADMIN role.
 *
 * Global roles on User.role:
 *   ADMIN       - platform-wide access. May read and administer every team,
 *                 work item, approval, and team membership.
 *   MANAGER     - team-scoped manager. A manager only has authority in teams
 *                 where they hold an active TeamMembership.
 *   TEAM_LEAD   - team-scoped lead. Same authority as a manager inside a team.
 *   MEMBER      - baseline user. Authority comes from active team membership.
 *   TEAM_MEMBER - team-scoped baseline member.
 *
 * TeamMembership.role can add team-scoped authority. Only TEAM_LEAD,
 * TEAM_MEMBER, and MEMBER are valid membership roles. ADMIN and MANAGER are
 * global roles and are never granted through a team membership; legacy rows
 * with those values are treated as TEAM_MEMBER for authorization.
 *
 * Effective authority inside a team is the higher of the user's global role
 * and their sanitized team membership role. No membership means no standing
 * in that team (except for a global ADMIN).
 *
 * Identity and role always come from the verified session. Client-supplied
 * role, user, team, and organization identifiers are never trusted.
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

export type ActiveTeamMembership = {
  id: string;
  teamId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
  team: {
    id: string;
    isActive: boolean;
  };
};

/**
 * Only these roles may be stored on a team membership. ADMIN and MANAGER are
 * global identities and cannot be granted by a team-level operation.
 */
export const TEAM_MEMBERSHIP_ROLES = [
  UserRole.TEAM_LEAD,
  UserRole.TEAM_MEMBER,
  UserRole.MEMBER,
] as const;

export type TeamMembershipRole = (typeof TEAM_MEMBERSHIP_ROLES)[number];

export function isTeamMembershipRole(role: UserRole): role is TeamMembershipRole {
  return (TEAM_MEMBERSHIP_ROLES as readonly UserRole[]).includes(role);
}

/** Team-scoped roles that may manage membership, assignment, and approvals. */
export function isTeamManagerRole(role: UserRole): boolean {
  return role === UserRole.MANAGER || role === UserRole.TEAM_LEAD;
}

/**
 * Resolve the effective role for a global role + team membership role without
 * touching the database. Used by both request authorization and roster
 * hierarchy checks.
 */
export function resolveEffectiveRole(
  globalRole: UserRole,
  membershipRole: UserRole,
): UserRole {
  if (globalRole === UserRole.ADMIN) return UserRole.ADMIN;

  const teamRole = isTeamMembershipRole(membershipRole)
    ? membershipRole
    : UserRole.TEAM_MEMBER;
  return roleWeight(teamRole) >= roleWeight(globalRole) ? teamRole : globalRole;
}

/**
 * Explicit, deny-by-default capability map for team-scoped actions. Ownership
 * rules (reporter/assignee) are applied on top of this map by the can* helpers.
 */
export type TeamCapability =
  | "view_team"
  | "create_work"
  | "comment_work"
  | "claim_work"
  | "edit_any_work"
  | "transition_any_work"
  | "assign_work"
  | "request_approval_any"
  | "decide_approval"
  | "manage_team";

const TEAM_CAPABILITIES = [
  "view_team",
  "create_work",
  "comment_work",
  "claim_work",
  "edit_any_work",
  "transition_any_work",
  "assign_work",
  "request_approval_any",
  "decide_approval",
  "manage_team",
] as const satisfies readonly TeamCapability[];

const MANAGER_CAPABILITIES = new Set<TeamCapability>(TEAM_CAPABILITIES);
const MEMBER_CAPABILITIES = new Set<TeamCapability>([
  "view_team",
  "create_work",
  "comment_work",
  "claim_work",
]);

export const TEAM_ROLE_CAPABILITIES: Readonly<
  Record<UserRole, ReadonlySet<TeamCapability>>
> = {
  [UserRole.ADMIN]: MANAGER_CAPABILITIES,
  [UserRole.MANAGER]: MANAGER_CAPABILITIES,
  [UserRole.TEAM_LEAD]: MANAGER_CAPABILITIES,
  [UserRole.MEMBER]: MEMBER_CAPABILITIES,
  [UserRole.TEAM_MEMBER]: MEMBER_CAPABILITIES,
};

/** Check the baseline capability map. Unknown/missing roles deny by default. */
export function roleHasTeamCapability(
  role: UserRole,
  capability: TeamCapability,
): boolean {
  return TEAM_ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

/** Load the active memberships for a user in active teams. */
export async function getUserMemberships(userId: string): Promise<ActiveTeamMembership[]> {
  return db.teamMembership.findMany({
    where: {
      userId,
      isActive: true,
      team: { isActive: true },
    },
    select: {
      id: true,
      teamId: true,
      userId: true,
      role: true,
      isActive: true,
      team: { select: { id: true, isActive: true } },
    },
  });
}

/**
 * Team ids a user may see. ADMIN is the only global override; all other roles
 * are limited to active team memberships. This is the single scope primitive
 * used by list, dashboard, team, and approval queries.
 */
export async function getVisibleTeamIds(user: AuthedUser): Promise<string[]> {
  if (user.role === UserRole.ADMIN) {
    const teams = await db.team.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return teams.map((team) => team.id);
  }
  return (await getUserMemberships(user.id)).map((membership) => membership.teamId);
}

/** Backwards-compatible membership-only helper. */
export async function getUserTeamIds(userId: string): Promise<string[]> {
  return (await getUserMemberships(userId)).map((membership) => membership.teamId);
}

/**
 * The user's effective role inside a specific team.
 *
 * ADMIN is global. Every other role needs an active membership. A legacy
 * ADMIN/MANAGER membership value is sanitized to TEAM_MEMBER so a malformed or
 * manually inserted membership can never mint a platform-level identity.
 */
export async function getEffectiveRole(
  user: AuthedUser,
  teamId: string,
): Promise<{ role: UserRole; membership: ActiveTeamMembership | null }> {
  if (user.role === UserRole.ADMIN) {
    return { role: UserRole.ADMIN, membership: null };
  }

  const membership = (await getUserMemberships(user.id)).find(
    (candidate) => candidate.teamId === teamId,
  );
  if (!membership) {
    return { role: UserRole.MEMBER, membership: null };
  }

  return {
    role: resolveEffectiveRole(user.role, membership.role),
    membership,
  };
}

/** Is this user an active member of the given team? */
export async function isActiveTeamMember(userId: string, teamId: string): Promise<boolean> {
  const membership = await db.teamMembership.findFirst({
    where: {
      userId,
      teamId,
      isActive: true,
      user: { isActive: true },
      team: { isActive: true },
    },
    select: { id: true },
  });
  return Boolean(membership);
}

/** Is the user an active member of the given team? ADMIN is global. */
export async function isTeamMember(user: AuthedUser, teamId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  return isActiveTeamMember(user.id, teamId);
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
  return isActiveTeamMember(user.id, item.teamId);
}

/** Can the user create a work item in a team? */
export async function canCreateWorkItem(
  user: AuthedUser,
  teamId: string,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  const { role, membership } = await getEffectiveRole(user, teamId);
  return Boolean(membership) && roleHasTeamCapability(role, "create_work");
}

/**
 * Can the user edit the non-assignment fields of this work item?
 * Team managers may edit any item in their team. A member may edit an item
 * they reported or are assigned to. Status is never changed by this path.
 */
export async function canEditWorkItem(
  user: AuthedUser,
  item: { teamId: string; reporterId: string; assigneeId: string | null },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;

  const { role, membership } = await getEffectiveRole(user, item.teamId);
  if (!membership) return false;
  if (roleHasTeamCapability(role, "edit_any_work")) return true;
  return item.reporterId === user.id || item.assigneeId === user.id;
}

/**
 * Can the user assign/reassign this work item? Passing null asks whether the
 * user may unassign. This is intentionally stricter than editing: reporters
 * and assignees can edit their item but cannot reassign it.
 */
export async function canAssignWorkItem(
  user: AuthedUser,
  item: { teamId: string },
  targetUserId: string | null,
): Promise<boolean> {
  if (targetUserId !== null && !(await isActiveTeamMember(targetUserId, item.teamId))) {
    return false;
  }

  if (user.role === UserRole.ADMIN) return true;

  const { role, membership } = await getEffectiveRole(user, item.teamId);
  return Boolean(membership) && roleHasTeamCapability(role, "assign_work");
}

/**
 * Can the user move this work item through the workflow? Team managers may
 * transition any team item; a member may transition only an item they
 * reported or are assigned to. The transition graph itself is validated by
 * the service.
 */
export async function canTransitionWorkItem(
  user: AuthedUser,
  item: { teamId: string; reporterId: string; assigneeId: string | null },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;

  const { role, membership } = await getEffectiveRole(user, item.teamId);
  if (!membership) return false;
  if (roleHasTeamCapability(role, "transition_any_work")) return true;
  return item.reporterId === user.id || item.assigneeId === user.id;
}

/** Can the user manage team settings and membership? */
export async function canManageTeam(user: AuthedUser, teamId: string): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  const { role, membership } = await getEffectiveRole(user, teamId);
  return Boolean(membership) && roleHasTeamCapability(role, "manage_team");
}

/** Can the user request an approval for this work item? */
export async function canRequestApproval(
  user: AuthedUser,
  item: { teamId: string; reporterId: string },
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;

  const { role, membership } = await getEffectiveRole(user, item.teamId);
  if (!membership) return false;
  return (
    roleHasTeamCapability(role, "request_approval_any") ||
    item.reporterId === user.id
  );
}

/**
 * Can the user decide (approve/reject) a pending approval?
 *
 * Self-approval is denied for every role, including ADMIN and MANAGER. An
 * approver must also hold an active membership in the work item's team with
 * manager/lead authority. ADMIN is the only global override.
 */
export async function canDecideApproval(
  user: AuthedUser,
  approval: { workItem: { teamId: string }; requestedById: string },
): Promise<boolean> {
  if (approval.requestedById === user.id) return false;

  if (user.role === UserRole.ADMIN) return true;

  const { role, membership } = await getEffectiveRole(user, approval.workItem.teamId);
  return Boolean(membership) && roleHasTeamCapability(role, "decide_approval");
}
