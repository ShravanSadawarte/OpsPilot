# OpsPilot

OpsPilot is a complete operational work management application built for the
Newtonite Software Engineering Challenge. It is a real, database-backed Next.js
application with authentication, team-based authorization, work-item workflows,
collaboration, audit history, concurrent-update protection, idempotent requests,
automated tests, and complete documentation.

## Features

- **Authentication**: session-based auth with Argon2id password hashing,
  HttpOnly cookies, session expiration/revocation, CSRF double-submit
  protection, and login rate limiting.
- **Authorization**: team-scoped roles with one explicit global ADMIN override,
  enforced at the server boundary on every protected endpoint. Managers and
  team leads only have authority in teams they belong to; team memberships
  cannot grant global ADMIN/MANAGER identities.
- **Work items**: create, view, edit, transition status, assign/claim, add
  comments, set due dates and labels, search/filter/sort/paginate server-side,
  direct links to items.
- **Workflow**: documented status transition map enforced on the server
  (OPEN, IN_PROGRESS, BLOCKED, IN_REVIEW, RESOLVED, CLOSED).
- **Dashboard**: permission-scoped metrics computed in PostgreSQL (open work,
  critical/high priority, overdue, unassigned, my work, pending approvals,
  recent activity, status/priority summaries, attention-required list).
- **Teams**: directory, details, membership management, team-specific roles,
  team work overview.
- **Collaboration**: persisted comments, activity timeline with actor and
  timestamp.
- **Approvals**: request, view pending, approve/reject (reason required for
  rejection), actor and decision timestamp recorded, self-approval denied for
  every role, cross-team decisions denied, duplicate/conflicting decisions
  prevented via atomic conditional update and an audit activity event.
- **Concurrency**: optimistic locking via `version` field with atomic
  conditional updates; stale updates return HTTP 409 `VERSION_CONFLICT`.
- **Idempotency**: `Idempotency-Key` header support for work-item creation,
  scoped to the authenticated actor, with a database uniqueness constraint.
- **Audit history**: work-item mutations and activity events persisted in the
  same PostgreSQL transaction.

## Architecture

Browser → Next.js App Router (Server Components + Route Handlers) → auth &
authorization → domain service layer → Prisma ORM → managed PostgreSQL.

API endpoints are versioned under `/api/v1/`. Business logic lives in
`src/server/services/` and is shared between Route Handlers and any Server
Actions. Database access is confined to server-only modules.

## Tech stack

- Next.js 16 (App Router, Route Handlers), React 19, TypeScript strict
- Tailwind CSS, shadcn/ui (Radix-based), Lucide React
- React Hook Form + Zod
- Prisma ORM + managed PostgreSQL (Neon recommended)
- Vitest, React Testing Library, Supertest, Playwright-ready
- ESLint, Prettier, GitHub Actions

## Prerequisites

- Node.js 20+
- npm
- A managed PostgreSQL database (Neon or Supabase). See
  [Database setup](#database-setup).
- A GitHub repository (for Vercel deployment).

## Local setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment example and fill in values:

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` (pooled runtime URL) and
`DATABASE_URL_DIRECT` (direct/migration URL), plus `AUTH_SECRET`
(generate with `openssl rand -base64 32`). `AUTH_SECRET` is used at runtime
to sign CSRF tokens; it is intentionally **not** required at build time.

3. Apply Prisma migrations:

```bash
npm run db:generate
npm run db:migrate
```

(`db:migrate` runs `prisma migrate dev`; for production use
`npm run db:migrate:deploy` which runs `prisma migrate deploy`.)

4. Seed development data:

```bash
npm run db:seed
```

5. Run the application:

```bash
npm run dev
```

Open http://localhost:3000/login and sign in with a demo account (see below).

## Environment configuration

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled runtime connection string (serverless). Never `NEXT_PUBLIC_`. |
| `DATABASE_URL_DIRECT` | Direct connection for migrations/seed. Never `NEXT_PUBLIC_`. |
| `APP_URL` | Public application URL. |
| `NODE_ENV` | `development` or `production`. |
| `AUTH_SECRET` | CSRF token signing secret (`openssl rand -base64 32`); runtime only. |
| `SESSION_TTL_SECONDS` | Session lifetime (default 86400 = 1 day). |
| `SESSION_COOKIE_SECURE` | `true` in production (HTTPS only). |
| `SESSION_COOKIE_SAMESITE` | `lax` (default). |
| `LOGIN_RATE_LIMIT_MAX` | Max failed logins per window (default 5). |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window seconds (default 300). |

Never commit `.env`. Database URLs and secrets must never use `NEXT_PUBLIC_`
prefixes.

## Database setup (Neon recommended)

1. Create a PostgreSQL project in Neon (neon.console).
2. Copy the pooled connection string into `DATABASE_URL` (add
   `?sslmode=require&pgbouncer=true`).
3. Copy the direct connection string into `DATABASE_URL_DIRECT`
   (used by Prisma migrations and seed).
4. Run `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`.

For Supabase, use the pooled URL (port 6543 / pooler) for `DATABASE_URL` and
the direct URL for `DATABASE_URL_DIRECT`, following the provider's current
documentation.

Migrations are run as an explicit deployment/release step (`prisma migrate
deploy`), not on every serverless invocation.

## Seed commands

```bash
# Generate Prisma Client
npm run db:generate

# Apply migrations (development)
npm run db:migrate

# Seed development data (repeatable, development-only)
npm run db:seed
```

## Demo accounts

Seed data creates these accounts (all with password `password123`):

| Email | Role | Team |
|---|---|---|
| admin@example.com | ADMIN | ALPHA |
| manager@example.com | MANAGER | BETA |
| lead.alpha@example.com | TEAM_LEAD | ALPHA |
| lead.beta@example.com | TEAM_LEAD | BETA |
| member.one@example.com | MEMBER | ALPHA |
| member.two@example.com | MEMBER | ALPHA |
| member.three@example.com | MEMBER | BETA |
| inactive@example.com | MEMBER | ALPHA (inactive) |

These credentials are development-only and must never be used in production.

## Development commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | TypeScript strict check |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests (requires test DB) |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (deploy) |
| `npm run db:seed` | Seed development data |

## Test commands

```bash
npm test              # all tests
npm run test:unit     # unit tests (workflow, permissions)
npm run test:integration  # integration tests (requires DATABASE_URL_TEST)
```

Unit tests cover the workflow transition map, the role/capability matrix,
team-scoped access, self-approval denial, assignment restrictions, team-role
escalation payloads, and strict request validation. Integration tests cover
the critical correctness behaviors and require a live test PostgreSQL database
(`DATABASE_URL_TEST`).

## Production build command

```bash
npm run build
```

The build compiles with Turbopack, runs TypeScript checking, and produces an
optimized `.next` output for Vercel.

## Vercel deployment

Full step-by-step instructions, the complete environment-variable list, and
migration steps are in **VERCEL_DEPLOYMENT.md**.

Quick summary:
1. Push the repository to GitHub.
2. In Vercel, "Add New Project" and import the repository.
3. Framework preset: Next.js. Build command: `npm run build`.
4. Add the environment variables from `.env.example` to Vercel Project Settings
   > Environment Variables (Production). Set `NODE_ENV=production` and
   `SESSION_COOKIE_SECURE=true`.
5. Set `DATABASE_URL` (pooled) and `DATABASE_URL_DIRECT` (direct/migration).
6. Before the first deploy, run migrations against production:
   `DATABASE_URL_DIRECT="<production direct URL>" npm run db:migrate:deploy`
7. Deploy and verify `https://<your-app>.vercel.app/login` plus core flows.

## API documentation

Versioned REST API under `/api/v1`. See `docs/API.md` for the OpenAPI-style
reference of implemented endpoints, request/response shapes, and error codes.

Versioned REST API under `/api/v1`. See `docs/API.md` for the OpenAPI-style
reference of implemented endpoints, request/response shapes, and error codes.

## Security notes

- Passwords are hashed with Argon2id via the `argon2` library (no custom
  crypto).
- Session tokens are stored as SHA-256 hashes; raw tokens exist only in
  HttpOnly cookies.
- Session expiration and revocation are validated on every request.
- Mutating endpoints require a signed double-submit CSRF token
  (`X-CSRF-Token` header matching the `ops_csrf` cookie; HMAC-SHA256 with
  `AUTH_SECRET`).
- Login is rate-limited per identifier (email or IP).
- No secrets or database URLs are exposed to the client bundle
  (no `NEXT_PUBLIC_` database/secrets).
- Authorization is revalidated at the server boundary; the proxy
  (`src/proxy.ts`) only performs early navigation redirects.
- See `docs/SECURITY.md` for the resource-disclosure policy and threat model.

See `ENGINEERING_DECISIONS.md` for design trade-offs and
`KNOWN_LIMITATIONS.md` for unimplemented features.
