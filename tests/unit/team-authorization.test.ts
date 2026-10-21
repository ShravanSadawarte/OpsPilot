import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  canManageTeam: vi.fn(),
  getEffectiveRole: vi.fn(),
  userFindUnique: vi.fn(),
  membershipUpsert: vi.fn(),
  membershipFindUnique: vi.fn(),
  membershipUpdate: vi.fn(),
}));

vi.mock("@/lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions")>();
  return {
    ...actual,
    canManageTeam: mocks.canManageTeam,
    getEffectiveRole: mocks.getEffectiveRole,
    getVisibleTeamIds: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    teamMembership: {
      upsert: mocks.membershipUpsert,
      findUnique: mocks.membershipFindUnique,
      update: mocks.membershipUpdate,
    },
    team: { findUnique: vi.fn() },
  },
}));

import { addTeamMember, removeTeamMember } from "@/server/services/team.service";

const TEAM = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";

const manager = {
  id: "manager-1",
  email: "manager@example.com",
  role: UserRole.MANAGER,
  isActive: true,
};
const teamLead = {
  id: "lead-1",
  email: "lead@example.com",
  role: UserRole.TEAM_LEAD,
  isActive: true,
};
const admin = {
  id: "admin-1",
  email: "admin@example.com",
  role: UserRole.ADMIN,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canManageTeam.mockResolvedValue(true);
  mocks.userFindUnique.mockResolvedValue({
    id: TARGET,
    isActive: true,
    role: UserRole.MEMBER,
  });
  mocks.membershipUpsert.mockResolvedValue({ id: "membership-1" });
  mocks.membershipUpdate.mockResolvedValue({ id: "membership-1" });
  mocks.membershipFindUnique.mockResolvedValue({
    id: "membership-1",
    userId: TARGET,
    teamId: TEAM,
    role: UserRole.TEAM_MEMBER,
    isActive: true,
    user: { id: TARGET, role: UserRole.MEMBER, isActive: true },
  });
  mocks.getEffectiveRole.mockResolvedValue({
    role: UserRole.TEAM_LEAD,
    membership: null,
  });
});

describe("team role assignment", () => {
  it("rejects a global ADMIN role before any database write", async () => {
    await expect(
      addTeamMember(manager, TEAM, {
        userId: TARGET,
        role: "ADMIN" as never,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("rejects a global MANAGER role before any database write", async () => {
    await expect(
      addTeamMember(manager, TEAM, {
        userId: TARGET,
        role: "MANAGER" as never,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("denies team leads the role-assignment operation", async () => {
    await expect(
      addTeamMember(teamLead, TEAM, { userId: TARGET, role: UserRole.TEAM_MEMBER }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("allows a manager to assign a team-scoped role", async () => {
    await addTeamMember(manager, TEAM, {
      userId: TARGET,
      role: UserRole.TEAM_MEMBER,
    });
    expect(mocks.membershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          teamId: TEAM,
          userId: TARGET,
          role: UserRole.TEAM_MEMBER,
        }),
      }),
    );
  });
});

describe("membership removal hierarchy", () => {
  it("refuses self-removal", async () => {
    await expect(
      removeTeamMember(teamLead, TEAM, teamLead.id),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("does not let a team lead remove a peer team lead", async () => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-2",
      userId: TARGET,
      teamId: TEAM,
      role: UserRole.TEAM_LEAD,
      isActive: true,
      user: { id: TARGET, role: UserRole.MEMBER, isActive: true },
    });

    await expect(
      removeTeamMember(teamLead, TEAM, TARGET),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("allows a team lead to remove an ordinary member", async () => {
    await removeTeamMember(teamLead, TEAM, TARGET);
    expect(mocks.membershipUpdate).toHaveBeenCalledOnce();
  });

  it("protects platform administrators from non-admin removal", async () => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-2",
      userId: TARGET,
      teamId: TEAM,
      role: UserRole.TEAM_MEMBER,
      isActive: true,
      user: { id: TARGET, role: UserRole.ADMIN, isActive: true },
    });

    await expect(
      removeTeamMember(manager, TEAM, TARGET),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("does not let a team lead remove a global manager", async () => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-2",
      userId: TARGET,
      teamId: TEAM,
      role: UserRole.TEAM_MEMBER,
      isActive: true,
      user: { id: TARGET, role: UserRole.MANAGER, isActive: true },
    });

    await expect(
      removeTeamMember(teamLead, TEAM, TARGET),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("does not let a manager remove a peer manager", async () => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-2",
      userId: TARGET,
      teamId: TEAM,
      role: UserRole.TEAM_MEMBER,
      isActive: true,
      user: { id: TARGET, role: UserRole.MANAGER, isActive: true },
    });
    mocks.getEffectiveRole.mockResolvedValue({
      role: UserRole.MANAGER,
      membership: null,
    });

    await expect(
      removeTeamMember(manager, TEAM, TARGET),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();
  });

  it("allows an administrator to remove any non-self membership", async () => {
    await removeTeamMember(admin, TEAM, TARGET);
    expect(mocks.membershipUpdate).toHaveBeenCalledOnce();
  });
});
