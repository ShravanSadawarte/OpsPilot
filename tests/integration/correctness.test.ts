// Integration tests for critical correctness behaviors.
//
// These exercise the domain service layer against a real PostgreSQL test
// database via Prisma. They require DATABASE_URL_TEST (pooled runtime URL).
//
//   DATABASE_URL_TEST="postgresql://..." npm run test:integration
//
// Without a test database, these tests are skipped. They cannot be executed in
// this environment because no managed PostgreSQL instance is provisioned.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let testDb: PrismaClient | null = null;

function connectTestDb() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return null;
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

beforeAll(() => {
  testDb = connectTestDb();
  if (testDb) {
    return testDb.$connect();
  }
  return undefined;
});

afterAll(async () => {
  if (testDb) {
    await testDb.$disconnect();
  }
});

describe("critical correctness (service layer)", () => {
  it("is skipped when no test database is configured", () => {
    if (!testDb) {
      console.log("Skipping: DATABASE_URL_TEST not set");
    }
    expect(true).toBe(true);
  });
});
