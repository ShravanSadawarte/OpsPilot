import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  WORK_ITEM_TRANSITIONS,
  statusLabel,
} from "@/lib/workflow";
import { WorkItemStatus } from "@prisma/client";

describe("workflow transition map", () => {
  it("allows OPEN -> IN_PROGRESS", () => {
    expect(isValidTransition(WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS)).toBe(true);
  });

  it("allows IN_PROGRESS -> RESOLVED", () => {
    expect(
      isValidTransition(WorkItemStatus.IN_PROGRESS, WorkItemStatus.RESOLVED),
    ).toBe(true);
  });

  it("rejects OPEN -> RESOLVED (skipping)", () => {
    expect(isValidTransition(WorkItemStatus.OPEN, WorkItemStatus.RESOLVED)).toBe(false);
  });

  it("rejects same-status transitions", () => {
    expect(isValidTransition(WorkItemStatus.OPEN, WorkItemStatus.OPEN)).toBe(false);
  });

  it("allows CLOSED -> OPEN (reopen)", () => {
    expect(isValidTransition(WorkItemStatus.CLOSED, WorkItemStatus.OPEN)).toBe(true);
  });

  it("reports all statuses have at least one outgoing transition except none", () => {
    for (const [from, allowed] of WORK_ITEM_TRANSITIONS) {
      expect(allowed.size).toBeGreaterThan(0);
    }
  });

  it("returns human labels", () => {
    expect(statusLabel(WorkItemStatus.OPEN)).toBe("Open");
    expect(statusLabel(WorkItemStatus.CLOSED)).toBe("Closed");
  });
});
