import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalStatus, UserRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  approvalFindUnique: vi.fn(),
  updateMany: vi.fn(),
  activityCreate: vi.fn(),
  workItemFindUnique: vi.fn(),
  transaction: vi.fn(),
  canViewWorkItem: vi.fn(),
  canDecideApproval: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    approval: { findUnique: mocks.approvalFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/permissions", () => ({
  canRequestApproval: vi.fn(),
  canDecideApproval: mocks.canDecideApproval,
  canViewWorkItem: mocks.canViewWorkItem,
  getVisibleTeamIds: vi.fn(),
}));

import { decideApproval } from "@/server/services/approval.service";

const approval = {
  id: "approval-1",
  workItemId: "item-1",
  requestedById: "requester-1",
  decidedById: null,
  status: ApprovalStatus.PENDING,
  reason: null,
  decidedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  workItem: {
    id: "item-1",
    teamId: "team-1",
    team: { id: "team-1" },
  },
  requestedBy: { id: "requester-1" },
};

const actor = {
  id: "manager-1",
  email: "manager@example.com",
  role: UserRole.MANAGER,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.approvalFindUnique.mockResolvedValue(approval);
  mocks.canViewWorkItem.mockResolvedValue(true);
  mocks.canDecideApproval.mockResolvedValue(true);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.activityCreate.mockResolvedValue({ id: "activity-1" });
  mocks.workItemFindUnique.mockResolvedValue({ id: "item-1" });
  mocks.transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        approval: {
          updateMany: mocks.updateMany,
          findUnique: vi.fn().mockResolvedValue({
            ...approval,
            status: ApprovalStatus.APPROVED,
            decidedById: actor.id,
          }),
        },
        activityEvent: { create: mocks.activityCreate },
        workItem: { findUnique: mocks.workItemFindUnique },
      }),
  );
});

describe("approval decision authorization and concurrency", () => {
  it("returns 404 before disclosing state to a cross-team caller", async () => {
    mocks.canViewWorkItem.mockResolvedValue(false);

    await expect(
      decideApproval(actor, "approval-1", { status: "APPROVED" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.canDecideApproval).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 409 for an already decided approval", async () => {
    mocks.approvalFindUnique.mockResolvedValue({
      ...approval,
      status: ApprovalStatus.REJECTED,
    });

    await expect(
      decideApproval(actor, "approval-1", { status: "APPROVED" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.canDecideApproval).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller cannot decide (including self-approval)", async () => {
    mocks.canDecideApproval.mockResolvedValue(false);

    await expect(
      decideApproval(actor, "approval-1", { status: "APPROVED" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("records the decision and an audit event in one transaction", async () => {
    const result = await decideApproval(actor, "approval-1", {
      status: "APPROVED",
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "approval-1", status: ApprovalStatus.PENDING },
      data: expect.objectContaining({
        status: ApprovalStatus.APPROVED,
        decidedById: actor.id,
      }),
    });
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workItemId: "item-1",
        actorId: actor.id,
        type: "APPROVED",
      }),
    });
    expect(result.status).toBe(200);
  });

  it("returns 409 when a concurrent decision already changed the row", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      decideApproval(actor, "approval-1", { status: "REJECTED", reason: "No" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("requires a reason for rejection", async () => {
    await expect(
      decideApproval(actor, "approval-1", { status: "REJECTED" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
