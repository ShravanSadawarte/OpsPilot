import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

/**
 * Development seed script.
 *
 * Safe and repeatable: uses upserts so running it multiple times produces the
 * same dataset without duplicating records. Development-only: refuses to run
 * when NODE_ENV=production.
 *
 * Usage:
 *   DATABASE_URL="..." DATABASE_URL_DIRECT="..." npx prisma db execute --schema prisma/schema.prisma --file prisma/seed.sql  (not used)
 *   or: DATABASE_URL="..." tsx prisma/seed.ts
 *
 * Connects via the DIRECT URL (migration connection) when provided, falling
 * back to DATABASE_URL, because seeding runs transactions and bulk inserts that
 * work best on a direct (non-pooled) connection.
 */

function connect() {
  const direct = process.env.DATABASE_URL_DIRECT;
  const url = direct || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Set DATABASE_URL (or DATABASE_URL_DIRECT) before seeding.");
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

const db = connect();

const PASSWORD = "password123"; // demo-only password, hashed with Argon2id

async function hash(pw: string) {
  return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Seeding is disabled in production (NODE_ENV=production). Set SEED_ALLOW_PRODUCTION=true only for an intentional demo/staging seed.",
    );
  }

  console.log("Seeding development data...");

  const passwordHash = await hash(PASSWORD);

  // --- Users (repeatable via upsert on email) ---
  const admin = await db.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash, role: "ADMIN", isActive: true },
    create: { email: "admin@example.com", name: "Admin User", passwordHash, role: "ADMIN", isActive: true },
  });

  const manager = await db.user.upsert({
    where: { email: "manager@example.com" },
    update: { passwordHash, role: "MANAGER", isActive: true },
    create: { email: "manager@example.com", name: "Manager One", passwordHash, role: "MANAGER", isActive: true },
  });

  const teamLeadA = await db.user.upsert({
    where: { email: "lead.alpha@example.com" },
    update: { passwordHash, role: "TEAM_LEAD", isActive: true },
    create: { email: "lead.alpha@example.com", name: "Lead Alpha", passwordHash, role: "TEAM_LEAD", isActive: true },
  });

  const teamLeadB = await db.user.upsert({
    where: { email: "lead.beta@example.com" },
    update: { passwordHash, role: "TEAM_LEAD", isActive: true },
    create: { email: "lead.beta@example.com", name: "Lead Beta", passwordHash, role: "TEAM_LEAD", isActive: true },
  });

  const member1 = await db.user.upsert({
    where: { email: "member.one@example.com" },
    update: { passwordHash, role: "MEMBER", isActive: true },
    create: { email: "member.one@example.com", name: "Member One", passwordHash, role: "MEMBER", isActive: true },
  });

  const member2 = await db.user.upsert({
    where: { email: "member.two@example.com" },
    update: { passwordHash, role: "MEMBER", isActive: true },
    create: { email: "member.two@example.com", name: "Member Two", passwordHash, role: "MEMBER", isActive: true },
  });

  const member3 = await db.user.upsert({
    where: { email: "member.three@example.com" },
    update: { passwordHash, role: "MEMBER", isActive: true },
    create: { email: "member.three@example.com", name: "Member Three", passwordHash, role: "MEMBER", isActive: true },
  });

  const inactive = await db.user.upsert({
    where: { email: "inactive@example.com" },
    update: { passwordHash, role: "MEMBER", isActive: false },
    create: { email: "inactive@example.com", name: "Inactive User", passwordHash, role: "MEMBER", isActive: false },
  });

  // --- Teams ---
  const teamAlpha = await db.team.upsert({
    where: { key: "ALPHA" },
    update: { name: "Alpha Operations", description: "Primary operations team", isActive: true },
    create: { key: "ALPHA", name: "Alpha Operations", description: "Primary operations team", isActive: true },
  });

  const teamBeta = await db.team.upsert({
    where: { key: "BETA" },
    update: { name: "Beta Platform", description: "Platform engineering team", isActive: true },
    create: { key: "BETA", name: "Beta Platform", description: "Platform engineering team", isActive: true },
  });

  // --- Memberships (repeatable via upsert on unique teamId/userId) ---
  const upsertMembership = (teamId: string, userId: string, role: string) =>
    db.teamMembership.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { role: role as any, isActive: true },
      create: { teamId, userId, role: role as any },
    });

  await upsertMembership(teamAlpha.id, admin.id, "ADMIN");
  await upsertMembership(teamAlpha.id, teamLeadA.id, "TEAM_LEAD");
  await upsertMembership(teamAlpha.id, member1.id, "TEAM_MEMBER");
  await upsertMembership(teamAlpha.id, member2.id, "TEAM_MEMBER");
  await upsertMembership(teamAlpha.id, inactive.id, "TEAM_MEMBER");

  await upsertMembership(teamBeta.id, manager.id, "MANAGER");
  await upsertMembership(teamBeta.id, teamLeadB.id, "TEAM_LEAD");
  await upsertMembership(teamBeta.id, member3.id, "TEAM_MEMBER");

  // --- Work items (20+) with varied states/priorities, assigned + unassigned, overdue + upcoming ---
  const now = new Date();
  const overdue = new Date(Date.now() - 10 * 86400000); // 10 days ago
  const upcoming = new Date(Date.now() + 10 * 86400000); // 10 days from now

  const items = [
    {
      publicKey: "OPS-1001", title: "Payment investigation: duplicate charge #4829", description: "Customer reported a duplicate charge on their invoice.",
      type: "PAYMENT_INVESTIGATION" as const, status: "OPEN" as const, priority: "CRITICAL" as const, team: teamAlpha, assignee: member1, reporter: admin, dueDate: overdue, version: 1,
    },
    {
      publicKey: "OPS-1002", title: "Incident: login API returning 500", description: "Intermittent 500 errors on the login endpoint.",
      type: "INCIDENT" as const, status: "IN_PROGRESS" as const, priority: "CRITICAL" as const, team: teamAlpha, assignee: teamLeadA, reporter: admin, dueDate: new Date(Date.now() - 2 * 86400000), version: 2,
    },
    {
      publicKey: "OPS-1003", title: "Compliance review: Q4 audit", description: "Prepare documentation for the quarterly compliance audit.",
      type: "COMPLIANCE_REQUEST" as const, status: "IN_REVIEW" as const, priority: "HIGH" as const, team: teamBeta, assignee: manager, reporter: manager, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1004", title: "Customer issue: missing refund", description: "Customer claims a refund was never received.",
      type: "CUSTOMER_ISSUE" as const, status: "OPEN" as const, priority: "HIGH" as const, team: teamAlpha, assignee: null, reporter: member1, dueDate: overdue, version: 1,
    },
    {
      publicKey: "OPS-1005", title: "Engineering task: refactor auth module", description: "Refactor the authentication module to use Argon2id.",
      type: "ENGINEERING_TASK" as const, status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, team: teamBeta, assignee: member3, reporter: teamLeadB, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1006", title: "Operational task: rotate DB credentials", description: "Rotate production database credentials per policy.",
      type: "OPERATIONAL_TASK" as const, status: "OPEN" as const, priority: "LOW" as const, team: teamAlpha, assignee: null, reporter: admin, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1007", title: "Incident: payment gateway timeout", description: "Payment gateway timing out under load.",
      type: "INCIDENT" as const, status: "BLOCKED" as const, priority: "CRITICAL" as const, team: teamAlpha, assignee: teamLeadA, reporter: admin, dueDate: overdue, version: 3,
    },
    {
      publicKey: "OPS-1008", title: "Customer issue: invoice discrepancy", description: "Customer disputes line items on invoice #9921.",
      type: "CUSTOMER_ISSUE" as const, status: "RESOLVED" as const, priority: "MEDIUM" as const, team: teamBeta, assignee: member3, reporter: manager, dueDate: new Date(Date.now() - 5 * 86400000), resolvedAt: new Date(Date.now() - 1 * 86400000), version: 2,
    },
    {
      publicKey: "OPS-1009", title: "Compliance: data retention policy", description: "Review and update data retention policy.",
      type: "COMPLIANCE_REQUEST" as const, status: "OPEN" as const, priority: "MEDIUM" as const, team: teamBeta, assignee: null, reporter: manager, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1010", title: "Engineering task: upgrade Node to 24", description: "Upgrade all services to Node.js 24.",
      type: "ENGINEERING_TASK" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, team: teamAlpha, assignee: member2, reporter: teamLeadA, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1011", title: "Payment investigation: failed settlement", description: "Settlement for batch #3310 failed to reconcile.",
      type: "PAYMENT_INVESTIGATION" as const, status: "OPEN" as const, priority: "HIGH" as const, team: teamAlpha, assignee: null, reporter: admin, dueDate: overdue, version: 1,
    },
    {
      publicKey: "OPS-1012", title: "Operational task: restart worker queue", description: "Restart the background worker queue after deploy.",
      type: "OPERATIONAL_TASK" as const, status: "CLOSED" as const, priority: "LOW" as const, team: teamAlpha, assignee: member1, reporter: admin, dueDate: new Date(Date.now() - 3 * 86400000), resolvedAt: new Date(Date.now() - 2 * 86400000), version: 1,
    },
    {
      publicKey: "OPS-1013", title: "Customer issue: password reset email", description: "Customer not receiving password reset emails.",
      type: "CUSTOMER_ISSUE" as const, status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, team: teamBeta, assignee: member3, reporter: manager, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1014", title: "Incident: memory leak in worker", description: "Worker process memory grows unbounded over time.",
      type: "INCIDENT" as const, status: "IN_REVIEW" as const, priority: "CRITICAL" as const, team: teamAlpha, assignee: teamLeadA, reporter: admin, dueDate: overdue, version: 2,
    },
    {
      publicKey: "OPS-1015", title: "Engineering task: add CI cache", description: "Add dependency caching to CI pipeline.",
      type: "ENGINEERING_TASK" as const, status: "OPEN" as const, priority: "LOW" as const, team: teamBeta, assignee: null, reporter: teamLeadB, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1016", title: "Compliance: SOC2 evidence collection", description: "Collect evidence for SOC2 audit.",
      type: "COMPLIANCE_REQUEST" as const, status: "OPEN" as const, priority: "HIGH" as const, team: teamBeta, assignee: manager, reporter: manager, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1017", title: "Payment investigation: chargeback #7741", description: "Customer initiated a chargeback.",
      type: "PAYMENT_INVESTIGATION" as const, status: "OPEN" as const, priority: "CRITICAL" as const, team: teamAlpha, assignee: member1, reporter: admin, dueDate: overdue, version: 1,
    },
    {
      publicKey: "OPS-1018", title: "Operational task: renew SSL certs", description: "Renew expiring SSL certificates.",
      type: "OPERATIONAL_TASK" as const, status: "RESOLVED" as const, priority: "MEDIUM" as const, team: teamAlpha, assignee: member2, reporter: admin, dueDate: new Date(Date.now() - 1 * 86400000), resolvedAt: new Date(), version: 2,
    },
    {
      publicKey: "OPS-1019", title: "Customer issue: dashboard not loading", description: "Customer dashboard shows blank screen.",
      type: "CUSTOMER_ISSUE" as const, status: "BLOCKED" as const, priority: "HIGH" as const, team: teamBeta, assignee: member3, reporter: manager, dueDate: overdue, version: 2,
    },
    {
      publicKey: "OPS-1020", title: "Engineering task: update dependencies", description: "Update npm dependencies across services.",
      type: "ENGINEERING_TASK" as const, status: "OPEN" as const, priority: "LOW" as const, team: teamAlpha, assignee: null, reporter: teamLeadA, dueDate: upcoming, version: 1,
    },
    {
      publicKey: "OPS-1021", title: "Incident: email delivery delayed", description: "Transactional emails delayed by 30+ minutes.",
      type: "INCIDENT" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, team: teamAlpha, assignee: teamLeadA, reporter: admin, dueDate: upcoming, version: 1,
    },
  ];

  for (const item of items) {
    await db.workItem.upsert({
      where: { publicKey: item.publicKey },
      update: {
        title: item.title,
        description: item.description,
        type: item.type,
        status: item.status,
        priority: item.priority,
        teamId: item.team.id,
        assigneeId: item.assignee?.id ?? null,
        reporterId: item.reporter.id,
        dueDate: item.dueDate,
        version: item.version,
        resolvedAt: item.resolvedAt,
      },
      create: {
        publicKey: item.publicKey,
        title: item.title,
        description: item.description,
        type: item.type,
        status: item.status,
        priority: item.priority,
        teamId: item.team.id,
        assigneeId: item.assignee?.id ?? null,
        reporterId: item.reporter.id,
        dueDate: item.dueDate,
        version: item.version,
        resolvedAt: item.resolvedAt,
      },
    });
  }

  // Keep the public-key sequence ahead of seeded OPS-#### keys so newly
  // created work items never collide with seed data.
  await db.$executeRawUnsafe(`
    SELECT setval(
      'workitem_public_key_seq',
      GREATEST(
        (SELECT COALESCE(MAX(CAST(SUBSTRING("publicKey" FROM 5) AS INTEGER)), 1000) FROM "WorkItem"),
        1000
      ),
      true
    )
  `);

  // --- Activity events for work items ---
  const wi1 = await db.workItem.findUnique({ where: { publicKey: "OPS-1001" } });
  const wi2 = await db.workItem.findUnique({ where: { publicKey: "OPS-1002" } });

  if (wi1) {
    await db.activityEvent.upsert({
      where: { id: "seed-activity-1001-1" },
      update: {},
      create: {
        id: "seed-activity-1001-1",
        workItemId: wi1.id,
        actorId: admin.id,
        type: "CREATED",
        metadata: { publicKey: "OPS-1001", title: wi1.title },
      },
    });
  }
  if (wi2) {
    await db.activityEvent.upsert({
      where: { id: "seed-activity-1002-1" },
      update: {},
      create: {
        id: "seed-activity-1002-1",
        workItemId: wi2.id,
        actorId: admin.id,
        type: "CREATED",
        metadata: { publicKey: "OPS-1002", title: wi2.title },
      },
    });
  }

  // --- Comments ---
  if (wi1) {
    await db.comment.upsert({
      where: { id: "seed-comment-1001-1" },
      update: {},
      create: {
        id: "seed-comment-1001-1",
        workItemId: wi1.id,
        authorId: member1.id,
        body: "Looking into the duplicate charge now.",
      },
    });
  }

  // --- Approvals ---
  // Pending approval on OPS-1003
  const wi3 = await db.workItem.findUnique({ where: { publicKey: "OPS-1003" } });
  if (wi3) {
    await db.approval.upsert({
      where: { id: "seed-approval-pending" },
      update: { status: "PENDING", decidedById: null, decidedAt: null, reason: null },
      create: {
        id: "seed-approval-pending",
        workItemId: wi3.id,
        requestedById: manager.id,
        status: "PENDING",
      },
    });
  }

  // Completed approval on OPS-1008 (resolved item)
  const wi8 = await db.workItem.findUnique({ where: { publicKey: "OPS-1008" } });
  if (wi8) {
    await db.approval.upsert({
      where: { id: "seed-approval-completed" },
      update: { status: "APPROVED", decidedById: teamLeadB.id, decidedAt: new Date(), reason: null },
      create: {
        id: "seed-approval-completed",
        workItemId: wi8.id,
        requestedById: manager.id,
        decidedById: teamLeadB.id,
        decidedAt: new Date(),
        status: "APPROVED",
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo accounts (password: ${PASSWORD}):`);
  console.log(`  admin:      admin@example.com      (ADMIN)`);
  console.log(`  manager:    manager@example.com    (MANAGER)`);
  console.log(`  lead alpha: lead.alpha@example.com (TEAM_LEAD, ALPHA)`);
  console.log(`  lead beta:  lead.beta@example.com  (TEAM_LEAD, BETA)`);
  console.log(`  member one: member.one@example.com (MEMBER, ALPHA)`);
}

main()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
