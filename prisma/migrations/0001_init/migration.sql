-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER', 'TEAM_LEAD', 'TEAM_MEMBER');

-- CreateEnum
CREATE TYPE "public"."WorkItemType" AS ENUM ('INCIDENT', 'CUSTOMER_ISSUE', 'ENGINEERING_TASK', 'PAYMENT_INVESTIGATION', 'COMPLIANCE_REQUEST', 'OPERATIONAL_TASK');

-- CreateEnum
CREATE TYPE "public"."WorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'COMMENT_ADDED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamMembership" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'TEAM_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "publicKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."WorkItemType" NOT NULL,
    "status" "public"."WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "teamId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "reporterId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "workItemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "workItemId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "public"."ActivityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Approval" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "workItemId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdempotencyRecord" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "actorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
CREATE INDEX "User_role_idx" ON "public"."User"("role");
CREATE INDEX "User_isActive_idx" ON "public"."User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token");
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_key_key" ON "public"."Team"("key");
CREATE INDEX "Team_isActive_idx" ON "public"."Team"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_userId_key" ON "public"."TeamMembership"("teamId", "userId");
CREATE INDEX "TeamMembership_teamId_idx" ON "public"."TeamMembership"("teamId");
CREATE INDEX "TeamMembership_userId_idx" ON "public"."TeamMembership"("userId");
CREATE INDEX "TeamMembership_teamId_isActive_idx" ON "public"."TeamMembership"("teamId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_publicKey_key" ON "public"."WorkItem"("publicKey");
CREATE INDEX "WorkItem_teamId_idx" ON "public"."WorkItem"("teamId");
CREATE INDEX "WorkItem_status_idx" ON "public"."WorkItem"("status");
CREATE INDEX "WorkItem_priority_idx" ON "public"."WorkItem"("priority");
CREATE INDEX "WorkItem_assigneeId_idx" ON "public"."WorkItem"("assigneeId");
CREATE INDEX "WorkItem_dueDate_idx" ON "public"."WorkItem"("dueDate");
CREATE INDEX "WorkItem_createdAt_idx" ON "public"."WorkItem"("createdAt");
CREATE INDEX "WorkItem_teamId_status_idx" ON "public"."WorkItem"("teamId", "status");
CREATE INDEX "WorkItem_teamId_createdAt_idx" ON "public"."WorkItem"("teamId", "createdAt");
CREATE INDEX "WorkItem_teamId_assigneeId_idx" ON "public"."WorkItem"("teamId", "assigneeId");

-- CreateIndex
CREATE INDEX "Comment_workItemId_idx" ON "public"."Comment"("workItemId");
CREATE INDEX "Comment_createdAt_idx" ON "public"."Comment"("createdAt");
CREATE INDEX "Comment_workItemId_createdAt_idx" ON "public"."Comment"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_workItemId_idx" ON "public"."ActivityEvent"("workItemId");
CREATE INDEX "ActivityEvent_createdAt_idx" ON "public"."ActivityEvent"("createdAt");
CREATE INDEX "ActivityEvent_workItemId_createdAt_idx" ON "public"."ActivityEvent"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_workItemId_idx" ON "public"."Approval"("workItemId");
CREATE INDEX "Approval_status_idx" ON "public"."Approval"("status");
CREATE INDEX "Approval_createdAt_idx" ON "public"."Approval"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_key_key" ON "public"."IdempotencyRecord"("actorId", "key");
CREATE INDEX "IdempotencyRecord_actorId_idx" ON "public"."IdempotencyRecord"("actorId");
CREATE INDEX "IdempotencyRecord_createdAt_idx" ON "public"."IdempotencyRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE;
ALTER TABLE "public"."TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkItem" ADD CONSTRAINT "WorkItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id");
ALTER TABLE "public"."WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL;
ALTER TABLE "public"."WorkItem" ADD CONSTRAINT "WorkItem_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id");

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "public"."WorkItem"("id") ON DELETE CASCADE;
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id");

-- AddForeignKey
ALTER TABLE "public"."ActivityEvent" ADD CONSTRAINT "ActivityEvent_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "public"."WorkItem"("id") ON DELETE CASCADE;
ALTER TABLE "public"."ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "public"."WorkItem"("id") ON DELETE CASCADE;
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id");
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."User"("id") ON DELETE SET NULL;

-- AddForeignKey
ALTER TABLE "public"."IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id");

-- Sequence for public key allocation (concurrency-safe)
CREATE SEQUENCE IF NOT EXISTS "public"."workitem_public_key_seq" START WITH 1001 INCREMENT BY 1;
