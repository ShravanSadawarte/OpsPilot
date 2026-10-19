# Engineering Decisions

This document records approximately five real architectural decisions made while
building OpsPilot, including context, alternatives considered, the selected
solution, trade-offs, and limitations.

## 1. Next.js App Router + Route Handlers

### Context
OpsPilot needs a server-rendered enterprise dashboard plus a documented,
versioned JSON API consumed by the same frontend. The stack mandate is Next.js
with the App Router.

### Alternatives
- **Next.js Pages Router + separate API routes**: older routing model, less
  aligned with the mandate, and weaker layout/nesting support for a sidebar
  shell.
- **Separate Vite frontend + Express backend**: would satisfy the API need but
  violates the mandate ("Do not create a separate Vite frontend or Express
  backend unless a concrete requirement makes that separation necessary") and
  adds deployment complexity (two projects, CORS, cookie sharing).
- **Server Actions only**: good for UI mutations but not a good fit for a
  documented, versioned REST API that may be called by non-browser clients.

### Selected solution
Next.js App Router with Server Components by default for read-heavy pages
(dashboard, work-item list, detail) and Route Handlers under
`app/api/v1/` for the versioned REST API. Mutations go through Route Handlers
(and the shared domain service layer), with Server Actions used only where a
UI mutation genuinely benefits.

### Trade-offs
- Route Handlers require explicit request/response handling (Zod validation,
  error envelopes) rather than the declarative form of Server Actions, but they
  produce a clean, testable, versioned API.
- Fetching a Route Handler from a Server Component in the same app is avoided;
  pages call the domain services directly.

### Limitations
- Route Handlers are serverless functions; long-running requests or large
  payloads must be kept within reasonable limits.
- `src/proxy.ts` (Next.js 16's renamed `middleware` convention) is used only
  for early navigation redirects and cache headers, never authorization.
- `AUTH_SECRET` is resolved lazily so `next build` never requires runtime
  secrets; it is used to HMAC-sign CSRF tokens at request time.

## 2. PostgreSQL + Prisma

### Context
A relational database is required for ACID transactions, conditional updates,
and complex queries (dashboard metrics, pagination, filtering). The mandate
requires Prisma ORM with migrations and a managed PostgreSQL provider.

### Alternatives
- **MongoDB / document store**: poor fit for relational data (teams, memberships,
  approvals) and lacks the transactional/conditional-update guarantees required
  by correctness behaviors A–E.
- **Raw `pg` client**: more boilerplate, no migration tooling, no type-safe
  queries.
- **Prisma Accelerate**: adds a managed connection pool but introduces another
  dependency and cost; the standard Prisma Client with `@prisma/adapter-pg`
  (node-postgres) is sufficient for Vercel serverless.

### Selected solution
Managed PostgreSQL (Neon is the documented primary provider) with Prisma ORM,
Prisma migrations, and a seed script. The runtime client uses
`@prisma/adapter-pg` backed by the pooled connection URL; migrations and seed
use the direct connection URL.

### Trade-offs
- Prisma 7 requires a driver adapter passed to the `PrismaClient` constructor
  (the `url` datasource field is no longer supported in schema files), so the
  connection is configured in `prisma.config.ts`.
- Neon's serverless driver could avoid node-postgres, but `@prisma/adapter-pg`
  is the stable, documented path for pooled Postgres on Vercel.

### Limitations
- A new Prisma Client is not created per request; a module-level singleton is
  reused within a process (serverless invocations are separate processes, which
  is acceptable).
- Prisma 7's config model (datasource URL in `prisma.config.ts`) differs from
  Prisma 2–6 documentation; this must be followed carefully.

## 3. Optimistic concurrency

### Context
Two users may read the same work item and update it simultaneously. The second
update must not silently overwrite the first.

### Alternatives
- **Read-then-unconditional-write**: rejects — a stale write would overwrite
  newer data without detection.
- **Last-write-wins with timestamps**: does not detect conflicts at the field
  level and can lose updates.
- **Pessimistic locking (`SELECT ... FOR UPDATE`)**: works but holds locks
  across the request, increasing contention and connection usage in serverless.

### Selected solution
Every `WorkItem` has an integer `version` starting at 1. Every update sends the
expected version read by the client. Updates use an atomic conditional database
update (`WHERE id = ? AND version = ?` with `version = version + 1`) inside
Prisma. If the row no longer matches the expected version, Prisma returns
P2025 (record not found), which is translated into HTTP 409 with error code
`VERSION_CONFLICT`. The frontend preserves unsaved edits and offers
refresh/reapply.

### Trade-offs
- Requires clients to track and send the version; the edit UI must handle 409
  gracefully (preserve edits, offer refresh/reapply).
- Does not prevent two users from starting edits simultaneously — it only
  rejects the second commit.

### Limitations
- The frontend conflict UX (preserving unsaved edits and reapplying) is
  implemented at a basic level; richer merge UIs are future work.

## 4. Authorization, idempotency, and transactional audit history

### Authorization
Global roles (ADMIN, MANAGER, MEMBER, TEAM_LEAD, TEAM_MEMBER) interact with
team-specific membership roles. The effective role within a team is the heavier
of the global role and the team membership role. ADMIN/MANAGER have cross-team
authority; TEAM_LEAD/TEAM_MEMBER are scoped to their teams. Centralized
`can*` functions (`canViewWorkItem`, `canCreateWorkItem`, `canEditWorkItem`,
`canAssignWorkItem`, `canTransitionWorkItem`, `canManageTeam`,
`canRequestApproval`, `canDecideApproval`) are used by domain services. Client
supplied IDs/roles are never trusted. 404 is used to avoid leaking existence
across teams; 403 is used when the resource exists but the caller cannot act.

### Idempotency
Work-item creation supports the `Idempotency-Key` header, scoped to the
authenticated actor. A request fingerprint (hash of the payload) and the
response body/status are stored in an `IdempotencyRecord` with a unique
constraint on `(actorId, key)`. Identical retries return the stored result;
key reuse with a different payload returns HTTP 409 `IDEMPOTENCY_CONFLICT`.
Simultaneous duplicates are handled by the unique constraint (one wins, the
other either returns the stored result or a conflict).

### Transactional audit history
Every work-item mutation and its required `ActivityEvent` are persisted in a
single Prisma transaction (`db.$transaction`). If the mutation fails, the
activity event is rolled back and not committed. `ActivityEvent` is append-only
by normal application behavior (no updates/deletes of events).

### Trade-offs
- Idempotency records grow unbounded; a TTL/cleanup job is future work.
- Transactional audit adds one extra write per mutation, a minor performance
  cost for strong correctness.

### Limitations
- Idempotency storage is in the same database; no separate idempotency store.
- The in-memory login rate-limit store is per serverless instance; multi-instance
  production deployments should back it with Redis.

## 5. Vercel adaptation and limits

### Context
The app deploys as one Vercel project using serverless functions.

### Selected solution
- Next.js App Router on Vercel with the Node.js runtime (not Edge, because
  Prisma/node-postgres requires Node.js database connections).
- Pooled runtime `DATABASE_URL` for the Prisma Client; direct
  `DATABASE_URL_DIRECT` for migrations.
- Migrations run as an explicit release step (`prisma migrate deploy`), never
  on every serverless invocation.
- No local disk persistence, no in-memory shared state across invocations, no
  unbounded background jobs. Session state is in the database; rate limiting is
  in-memory per instance (documented limitation).
- Cache-Control headers set to `private, no-store` for protected/API routes so
  personalized data is never cached publicly.
- Secrets are never `NEXT_PUBLIC_`.

### Trade-offs
- Serverless connection limits: the Prisma Client singleton plus a pooled
  connection keep per-invocation connections reasonable, but high concurrency
  may require Neon's connection pooling (configured).
- No long-running worker; background processing is optional and would need a
  managed queue (not implemented).

### Limitations
- Real-time features (WebSockets, live collaboration) are not supported on
  serverless without an external service.
- In-memory rate limiting resets per cold start / per instance.
- Vercel function timeout and payload limits apply to Route Handlers.
