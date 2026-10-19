import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Safely initialize a single Prisma Client instance within a running process.
 *
 * In a long-running dev server (next dev) we must avoid creating a new client
 * on every hot-reload, which would exhaust connections. In serverless
 * (Vercel) each invocation is its own process, so a module-level singleton is
 * scoped to that invocation — which is exactly what we want.
 *
 * Prisma 7 requires a driver adapter. We use @prisma/adapter-pg (node-postgres)
 * backed by the pooled DATABASE_URL, appropriate for Vercel serverless + Neon.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const db = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export default db;
