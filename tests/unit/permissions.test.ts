import { describe, it, expect, vi } from "vitest";

// Mock the server-only db module so permissions (which imports it) can load in tests.
vi.mock("@/lib/db", () => ({ db: {} }));

import { roleWeight } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

describe("role weight", () => {
  it("ranks ADMIN highest", () => {
    expect(roleWeight(UserRole.ADMIN)).toBeGreaterThan(roleWeight(UserRole.MANAGER));
  });

  it("ranks MANAGER above TEAM_LEAD", () => {
    expect(roleWeight(UserRole.MANAGER)).toBeGreaterThan(roleWeight(UserRole.TEAM_LEAD));
  });

  it("ranks TEAM_LEAD above MEMBER", () => {
    expect(roleWeight(UserRole.TEAM_LEAD)).toBeGreaterThan(roleWeight(UserRole.MEMBER));
  });

  it("ranks MEMBER above TEAM_MEMBER", () => {
    expect(roleWeight(UserRole.MEMBER)).toBeGreaterThan(roleWeight(UserRole.TEAM_MEMBER));
  });
});
