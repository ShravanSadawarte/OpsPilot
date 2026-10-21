import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  membershipFindMany: vi.fn(),
  membershipFindFirst: vi.fn(),
  teamFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    teamMembership: {
      findMany: mocks.membershipFindMany,
      findFirst: mocks.membershipFindFirst,
    },
    team: {
      findMany: mocks.teamFindMany,
    },
  },
}));

import {
  canAssignWorkItem,
  canCreateWorkItem,
  canDecideApproval,
  canEditWorkItem,
  canManageTeam,
  canRequestApproval,
  canTransitionWorkItem,
  canViewWorkItem,
  getVisibleTeamIds,
  resolveEffectiveRole,
  roleHasTeamCapability,
  type ActiveTeamMembership,
  type AuthedUser,
} from "@/lib/permissions";
import {
  AddTeamMemberSchema,
  CreateWorkItemSchema,
  UpdateWorkItemSchema,
  WorkItemFiltersSchema,
} from "@/lib/validation";

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";

function membership(
  teamId: string,
  role: UserRole,
  userId = "user-1",
): ActiveTeamMembership {
  return {
    id: `membership-${teamId}`,
    teamId,
    userId,
    role,
    isActive: true,
    team: { id: teamId, isActive: true },
  };
}

function actor(role: UserRole, id = "user-1"): AuthedUser {
  return { id, email: `${id}@example.com`, role, isActive: true };
}

function setMemberships(rows: ActiveTeamMembership[]) {
  mocks.membershipFindMany.mockResolvedValue(rows);
  mocks.membershipFindFirst.mockImplementation(
    ({ where }: { where: { userId?: string; teamId?: string } }) =>
      Promise.resolve(
        rows.find(
          (row) =>
            (!where.userId || row.userId === where.userId) &&
            (!where.teamId || row.teamId === where.teamId),
        ) ?? null,
      ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.teamFindMany.mockResolvedValue([{ id: TEAM_A }, { id: TEAM_B }]);
  setMemberships([]);
});

describe("role capability map", () => {
  it("grants team administration only to managers, leads, and admins", () => {
    expect(roleHasTeamCapability(UserRole.ADMIN, "manage_team")).toBe(true);
    expect(roleHasTeamCapability(UserRole.MANAGER, "manage_team")).toBe(true);
    expect(roleHasTeamCapability(UserRole.TEAM_LEAD, "manage_team")).toBe(true);
    expect(roleHasTeamCapability(UserRole.MEMBER, "manage_team")).toBe(false);
    expect(roleHasTeamCapability(UserRole.TEAM_MEMBER, "manage_team")).toBe(false);
  });

  it("denies capabilities for an unknown/malformed role", () => {
    expect(
      roleHasTeamCapability("NOT_A_ROLE" as UserRole, "view_team"),
    ).toBe(false);
  });

  it("sanitizes legacy ADMIN/MANAGER membership values", () => {
    expect(resolveEffectiveRole(UserRole.MEMBER, UserRole.ADMIN)).toBe(UserRole.MEMBER);
    expect(resolveEffectiveRole(UserRole.MEMBER, UserRole.MANAGER)).toBe(UserRole.MEMBER);
  });

  it("uses the higher of global and team-scoped authority", () => {
    expect(resolveEffectiveRole(UserRole.TEAM_MEMBER, UserRole.TEAM_LEAD)).toBe(
      UserRole.TEAM_LEAD,
    );
    expect(resolveEffectiveRole(UserRole.MANAGER, UserRole.TEAM_MEMBER)).toBe(
      UserRole.MANAGER,
    );
    expect(resolveEffectiveRole(UserRole.ADMIN, UserRole.TEAM_MEMBER)).toBe(
      UserRole.ADMIN,
    );
  });
});

describe("team visibility", () => {
  it("lets ADMIN see every active team", async () => {
    await expect(getVisibleTeamIds(actor(UserRole.ADMIN))).resolves.toEqual([
      TEAM_A,
      TEAM_B,
    ]);
    expect(mocks.teamFindMany).toHaveBeenCalledOnce();
  });

  it("scopes a manager to active memberships", async () => {
    setMemberships([membership(TEAM_A, UserRole.MANAGER)]);
    await expect(getVisibleTeamIds(actor(UserRole.MANAGER))).resolves.toEqual([
      TEAM_A,
    ]);
  });
});

describe("manager authority is team-scoped", () => {
  it("denies a manager outside their memberships", async () => {
    const manager = actor(UserRole.MANAGER);
    await expect(canViewWorkItem(manager, { teamId: TEAM_B })).resolves.toBe(false);
    await expect(canManageTeam(manager, TEAM_B)).resolves.toBe(false);
    await expect(canCreateWorkItem(manager, TEAM_B)).resolves.toBe(false);
    await expect(
      canDecideApproval(manager, {
        workItem: { teamId: TEAM_B },
        requestedById: "someone-else",
      }),
    ).resolves.toBe(false);
  });

  it("allows a manager inside their own team", async () => {
    const manager = actor(UserRole.MANAGER);
    setMemberships([membership(TEAM_A, UserRole.MANAGER)]);
    await expect(canViewWorkItem(manager, { teamId: TEAM_A })).resolves.toBe(true);
    await expect(canManageTeam(manager, TEAM_A)).resolves.toBe(true);
    await expect(canCreateWorkItem(manager, TEAM_A)).resolves.toBe(true);
    await expect(
      canDecideApproval(manager, {
        workItem: { teamId: TEAM_A },
        requestedById: "someone-else",
      }),
    ).resolves.toBe(true);
  });
});

describe("members cannot exercise manager-only actions", () => {
  it("allows viewing, creating, editing and transitioning owned work", async () => {
    const member = actor(UserRole.MEMBER);
    setMemberships([membership(TEAM_A, UserRole.TEAM_MEMBER)]);
    const item = { teamId: TEAM_A, reporterId: member.id, assigneeId: null };

    await expect(canViewWorkItem(member, item)).resolves.toBe(true);
    await expect(canCreateWorkItem(member, TEAM_A)).resolves.toBe(true);
    await expect(canEditWorkItem(member, item)).resolves.toBe(true);
    await expect(canTransitionWorkItem(member, item)).resolves.toBe(true);
    await expect(
      canRequestApproval(member, { teamId: TEAM_A, reporterId: member.id }),
    ).resolves.toBe(true);
  });

  it("denies assigning, managing, deciding, and transitions on other work", async () => {
    const member = actor(UserRole.MEMBER);
    setMemberships([membership(TEAM_A, UserRole.TEAM_MEMBER)]);
    const otherItem = {
      teamId: TEAM_A,
      reporterId: "another-user",
      assigneeId: "another-user",
    };

    await expect(canAssignWorkItem(member, { teamId: TEAM_A }, null)).resolves.toBe(false);
    await expect(canManageTeam(member, TEAM_A)).resolves.toBe(false);
    await expect(
      canDecideApproval(member, {
        workItem: { teamId: TEAM_A },
        requestedById: "another-user",
      }),
    ).resolves.toBe(false);
    await expect(canTransitionWorkItem(member, otherItem)).resolves.toBe(false);
    await expect(canEditWorkItem(member, otherItem)).resolves.toBe(false);
  });

  it("denies a user with no active membership", async () => {
    const member = actor(UserRole.TEAM_MEMBER);
    await expect(canViewWorkItem(member, { teamId: TEAM_A })).resolves.toBe(false);
    await expect(canCreateWorkItem(member, TEAM_A)).resolves.toBe(false);
  });
});

describe("privilege escalation defenses", () => {
  it("does not turn a legacy elevated membership role into team authority", async () => {
    const member = actor(UserRole.MEMBER);
    setMemberships([membership(TEAM_A, UserRole.ADMIN)]);
    await expect(canManageTeam(member, TEAM_A)).resolves.toBe(false);
    await expect(
      canDecideApproval(member, {
        workItem: { teamId: TEAM_A },
        requestedById: "another-user",
      }),
    ).resolves.toBe(false);
  });

  it("denies self-approval even for an admin", async () => {
    const admin = actor(UserRole.ADMIN);
    await expect(
      canDecideApproval(admin, {
        workItem: { teamId: TEAM_A },
        requestedById: admin.id,
      }),
    ).resolves.toBe(false);
  });

  it("requires an assignment target to be an active member of the same team", async () => {
    const lead = actor(UserRole.TEAM_LEAD);
    setMemberships([membership(TEAM_A, UserRole.TEAM_LEAD)]);

    mocks.membershipFindFirst.mockResolvedValueOnce(null);
    await expect(
      canAssignWorkItem(lead, { teamId: TEAM_A }, "outsider"),
    ).resolves.toBe(false);

    mocks.membershipFindFirst.mockResolvedValueOnce({ id: "target-membership" });
    await expect(
      canAssignWorkItem(lead, { teamId: TEAM_A }, "member-2"),
    ).resolves.toBe(true);
  });
});

describe("request payload validation", () => {
  it("rejects PATCH status changes so they cannot bypass the workflow", () => {
    const result = UpdateWorkItemSchema.safeParse({
      status: "CLOSED",
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects client-supplied ownership fields on create", () => {
    const result = CreateWorkItemSchema.safeParse({
      title: "Example",
      type: "INCIDENT",
      teamId: TEAM_A,
      reporterId: "someone-else",
      status: "CLOSED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects global ADMIN/MANAGER values on a team membership", () => {
    expect(
      AddTeamMemberSchema.safeParse({
        userId: TEAM_A,
        role: "ADMIN",
      }).success,
    ).toBe(false);
    expect(
      AddTeamMemberSchema.safeParse({
        userId: TEAM_A,
        role: "TEAM_LEAD",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed list filters instead of passing them to Prisma", () => {
    expect(WorkItemFiltersSchema.safeParse({ status: "NOT_A_STATUS" }).success).toBe(
      false,
    );
    expect(WorkItemFiltersSchema.safeParse({ teamId: "not-a-uuid" }).success).toBe(
      false,
    );
  });
});
