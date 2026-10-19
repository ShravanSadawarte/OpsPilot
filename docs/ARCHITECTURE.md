# OpsPilot Architecture

## Overview

OpsPilot is a single Vercel-deployed Next.js application. All database
operations and business logic run on the server; the browser talks to Next.js
pages/layouts and versioned Route Handlers.

```
Browser
  -> Next.js pages and layouts (App Router)
  -> Next.js Route Handlers (/api/v1/*)
  -> authentication & authorization
  -> domain service layer
  -> Prisma ORM
  -> managed PostgreSQL (Neon)
```

## Directory layout (adapted from the mandate)

```
src/
  app/
    (auth)/login/          # sign-in page (public)
    (app)/                 # private app shell (sidebar + topbar)
      dashboard/
      work-items/
      work-items/[id]/
      work-items/[id]/edit/
      work-items/create/
      approvals/
      teams/
      layout.tsx           # private layout (requires session)
    (auth)/layout.tsx      # auth layout
    layout.tsx             # root layout (ToastProvider, fonts)
    globals.css
    middleware.ts          # early navigation redirects + cache headers
    api/
      v1/
        auth/              # login, logout, me, csrf
        users/me/
        teams/             # list, create
        teams/[id]/        # get, update
        teams/[id]/members/# add, remove member
        teams/[id]/overview# team work metrics
        work-items/        # list, create (idempotent)
        work-items/[id]/   # get, update, transition
        work-items/[id]/assign/
        work-items/[id]/claim/
        work-items/[id]/comments/
        work-items/[id]/activity/
        approvals/         # list pending, request
        approvals/[id]/    # get, decide
        dashboard/         # permission-scoped metrics
  components/
    ui/                    # shadcn/ui primitives
    layout/                # sidebar, topbar
    work-items/            # actions, comment-thread, activity-timeline
    approvals/             # approval-decider
  hooks/
    use-user.ts            # session restoration client hook
  lib/
    auth.ts                # Argon2id, sessions, CSRF, rate limiting
    db.ts                  # Prisma Client singleton (server-only)
    http.ts                # API response envelopes + error codes
    api-handler.ts         # withAuth wrapper (auth + CSRF + error handling)
    validation.ts          # Zod schemas shared by Route Handlers
    permissions.ts         # can* authorization functions
    workflow.ts            # status transition map
    api-client.ts          # fetch wrapper with CSRF + 401 redirect
  server/
    services/
      auth.service.ts      # login/logout/me
      workItem.service.ts  # work items, comments, activity
      approval.service.ts  # approval requests/decisions
      team.service.ts      # teams, memberships, overview
      dashboard.service.ts # permission-scoped metrics
  types/
    api.ts                 # TypeScript interfaces for API responses
prisma/
  schema.prisma            # data model
  migrations/              # SQL migrations
  seed.ts                  # development seed script
tests/
  unit/                    # Vitest unit tests (no DB)
  integration/             # Vitest integration tests (requires test DB)
docs/
  ARCHITECTURE.md
  API.md
  SECURITY.md
```

## Key design choices

### Server-only modules
Modules that touch the database (`src/lib/db.ts`, `src/lib/auth.ts`,
`src/lib/permissions.ts`, `src/server/services/*`) are server-only and never
imported into Client Components. The `server-only` package enforces this at
build time.

### Connection strategy
Prisma Client is a module-level singleton reused within a process
(`src/lib/db.ts`). Prisma 7 requires a driver adapter, so
`@prisma/adapter-pg` (node-postgres) wraps the pooled `DATABASE_URL`. Serverless
instances on Vercel are separate processes; each gets its own client, which is
acceptable. Migrations and seed use the direct `DATABASE_URL_DIRECT`.

### Authentication
Custom session-based authentication (documented decision): Argon2id password
hashing via the `argon2` library, SHA-256-hashed session tokens stored in the
database, HttpOnly cookies, session expiration/revocation validation, CSRF
double-submit protection, and login rate limiting. This avoids the complexity
and version-compatibility risk of integrating Auth.js with Next.js 16/React 19.

### Authorization
Global roles (ADMIN, MANAGER, MEMBER, TEAM_LEAD, TEAM_MEMBER) combine with
team-specific membership roles. Centralized `can*` functions are invoked by the
domain service layer at the server boundary — not only in middleware or UI.
Middleware performs early navigation redirects only.

### Data model
Users, Sessions, Teams, TeamMemberships (unique per team/user), WorkItems
(uuid + `OPS-####` public key via a PostgreSQL sequence), Comments,
ActivityEvents (append-only), Approvals, IdempotencyRecords. Indexes cover
team, status, priority, assignee, due date, creation date, and activity
ordering.

## Vercel deployment

- One Vercel project; Next.js auto-detected.
- Node.js runtime (Prisma/node-postgres requires Node, not Edge).
- Build command: `npm run build`; Install command: `npm install`.
- Migrations run as an explicit release step (`prisma migrate deploy`).
- No `vercel.json` is required for standard Next.js deployment.

## Limits

- Serverless function timeouts and payload limits apply to Route Handlers.
- In-memory login rate limiting is per instance (use Redis in multi-instance
  prod).
- No WebSockets / real-time without an external service.
- No long-running workers or local disk persistence.
