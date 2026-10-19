# Vercel Deployment — OpsPilot

This guide covers deploying OpsPilot to Vercel with a managed PostgreSQL
database (Neon is the documented primary provider; Supabase is also supported).

## Prerequisites

- A GitHub repository containing this project.
- A Vercel account (vercel.com) connected to your GitHub.
- A managed PostgreSQL database (Neon or Supabase).
- OpenSSL (to generate `AUTH_SECRET`).

---

## Step 1: Create the managed PostgreSQL database

### Option A: Neon (recommended)

1. Go to https://console.neon.tech and create a new project.
2. Create a database (e.g. `ops`).
3. In the connection string widget, select **Node.js** driver and **Pooler**.
   Copy the pooled connection string:

   ```
   postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/ops?sslmode=require&pgbouncer=true
   ```

4. Select **Direct** connection and copy the direct URL (used by migrations):

   ```
   postgresql://USER:PASSWORD@ep-xxx.us-east-1.aws.neon.tech/DB?sslmode=require
   ```

### Option B: Supabase

1. Go to https://app.supabase.com and create a new project.
2. Go to Settings > Database.
3. Copy the **Connection string > Transaction pooler (port 6543)** for
   `DATABASE_URL` (pooled runtime).
4. Copy the **Connection string > Direct (port 5432)** for
   `DATABASE_URL_DIRECT` (migrations).

> ⚠️ Do not prefix either URL with `NEXT_PUBLIC_`. They must never reach the
> browser bundle.

---

## Step 2: Generate the session secret

Run locally:

```bash
openssl rand -base64 32
```

Use the output as `AUTH_SECRET`. Rotate it if you suspect compromise (this
invalidates all existing sessions).

---

## Step 3: Connect the GitHub repository to Vercel

1. Log in to https://vercel.com.
2. Click **Add New Project** → **Import Git Repository**.
3. Select your OpsPilot repository.
4. Framework preset: **Next.js** (auto-detected).
5. Build Command: `npm run build` (default).
6. Install Command: `npm install` (default).
7. Output Directory: `.next` (default).
8. Click **Deploy**.

> The first deployment will fail at the build step if environment variables are
> not set — that is expected. Add the variables in Step 4, then redeploy.

---

## Step 4: Configure environment variables in Vercel

In the Vercel dashboard: **Project Settings → Environment Variables**.

Add each variable below for **Production** (and Preview as needed). Do not
commit these to the repository.

| Variable | Required | Production value | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | Pooled Neon/Supabase URL | Runtime connection (serverless). No `NEXT_PUBLIC_` prefix. |
| `DATABASE_URL_DIRECT` | Yes | Direct Neon/Supabase URL | Used by `prisma migrate deploy`. No `NEXT_PUBLIC_` prefix. |
| `APP_URL` | Yes | `https://<your-app>.vercel.app` | Public application URL. |
| `NODE_ENV` | Yes | `production` | Enables secure cookie settings and production logging. |
| `AUTH_SECRET` | Yes | Output from `openssl rand -base64 32` | Signs CSRF tokens at runtime; not required at build time. |
| `SESSION_TTL_SECONDS` | No | `86400` | Session lifetime in seconds (1 day). |
| `SESSION_COOKIE_SAMESITE` | No | `lax` | `lax` \| `strict` \| `none`. |
| `SESSION_COOKIE_SECURE` | Yes | `true` | Must be `true` on Vercel (HTTPS only). |
| `LOGIN_RATE_LIMIT_MAX` | No | `5` | Max failed logins per window. |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | No | `300` | Rate-limit window in seconds. |

**Vercel-specific notes:**
- `SESSION_COOKIE_SECURE=true` is required because Vercel serves over HTTPS.
- `DATABASE_URL` uses the **pooled** connection (pgbouncer) so serverless
  functions do not exhaust Postgres connections.
- `DATABASE_URL_DIRECT` uses the **direct** connection for migrations and seed.

---

## Step 5: Apply production migrations safely

Run migrations as an explicit release step — never on every serverless
invocation.

### Option A: Run locally against the production database

```bash
# Point Prisma at the production direct URL
DATABASE_URL_DIRECT="<production direct URL>" npm run db:migrate:deploy
```

This runs `prisma migrate deploy` against the production database.

### Option B: Run via Vercel CLI (if installed)

```bash
vercel pull --environment production
vercel env pull .env
DATABASE_URL_DIRECT="$(grep DATABASE_URL_DIRECT .env | cut -d= -f2-)" npx prisma migrate deploy
```

> Do **not** add `prisma migrate dev` to the build command or a postinstall
> hook — destructive schema changes must not run on every serverless
> invocation.

---

## Step 6: Deploy and verify

1. Redeploy the project in Vercel (or push to `main` if auto-deploy is on).
2. Wait for the build to complete.
3. Open `https://<your-app>.vercel.app/login`.
4. Sign in with a seeded demo account (only if you seeded the production DB;
   otherwise create an account through your own registration flow).
5. Verify core flows:
   - Sign in / sign out
   - Dashboard loads with database-backed metrics
   - Create a work item
   - View work item detail
   - Transition status (and version conflict on concurrent edits)
   - Approve / reject a pending approval
   - Team management

### Health endpoint

There is no dedicated health endpoint. Verify deployment by loading
`https://<your-app>.vercel.app/login` (should render without error) and
`https://<your-app>.vercel.app/api/v1/users/me` (returns 401 without a session,
confirming the API layer is wired).

---

## Step 7: Seed development data (production demo data — optional)

If you want seed data in a staging/preview environment:

```bash
DATABASE_URL_DIRECT="<staging direct URL>" NODE_ENV=development npm run db:seed
```

> ⚠️ Seed data is development-only. The seed script refuses to run when
> `NODE_ENV=production`. Do not seed a production database with demo accounts.

---

## Complete environment variable reference

| Variable | Example | Required on Vercel | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://...&pgbouncer=true` | Yes | Pooled runtime connection for the Prisma Client (serverless). |
| `DATABASE_URL_DIRECT` | `postgresql://...` | Yes | Direct connection for `prisma migrate deploy` / seed. |
| `APP_URL` | `https://ops-pilot.vercel.app` | Yes | Public application URL. |
| `NODE_ENV` | `production` | Yes | Production mode (secure cookies, prod logging). |
| `AUTH_SECRET` | `<32+ chars base64>` | Yes | CSRF token signing secret (runtime; build works without it). |
| `SESSION_TTL_SECONDS` | `86400` | No | Session lifetime (default 1 day). |
| `SESSION_COOKIE_SAMESITE` | `lax` | No | Cookie SameSite mode. |
| `SESSION_COOKIE_SECURE` | `true` | Yes | Must be `true` on Vercel (HTTPS). |
| `LOGIN_RATE_LIMIT_MAX` | `5` | No | Max failed logins per window per identifier. |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `300` | No | Rate-limit window seconds. |

### Variables NOT to set
- Do **not** set any variable with a `NEXT_PUBLIC_` prefix for database URLs or secrets.
- Do **not** set `DATABASE_URL` or `DATABASE_URL_DIRECT` as `NEXT_PUBLIC_*`.

---

## Troubleshooting

| Issue | Likely cause | Fix |
|---|---|---|
| Build fails at TypeScript | Genuine type error (runtime secrets are not required at build) | Fix the reported type error; `AUTH_SECRET`/`DATABASE_URL` are runtime-only. |
| 500 on `/api/v1/users/me` | `DATABASE_URL` missing or wrong | Verify pooled URL in Vercel env vars. |
| Session cookie not set | `SESSION_COOKIE_SECURE` mismatch | On Vercel (HTTPS), set `SESSION_COOKIE_SECURE=true`. |
| Login rate limit too strict | `LOGIN_RATE_LIMIT_MAX` too low | Increase in Vercel env vars. |
| Prisma migrate deploy fails | Wrong `DATABASE_URL_DIRECT` | Use the direct (non-pooled) URL. |
| 403 on all mutating API routes | `AUTH_SECRET` missing or changed | Set/align `AUTH_SECRET` in Vercel env vars, then reload the page to refresh the CSRF cookie. |

---

## Files relevant to deployment

- `vercel.json` — function timeout config (no routes required for standard Next.js).
- `.env.example` — full variable reference (copy locally, add to Vercel dashboard).
- `prisma/schema.prisma` — data model.
- `prisma/migrations/0001_init/migration.sql` — initial schema.
- `prisma/seed.ts` — development seed (NODE_ENV=development only).
- `ENGINEERING_DECISIONS.md` — decision on Vercel architecture and limits.
- `KNOWN_LIMITATIONS.md` — deployment-related limitations (serverless timeouts, no WebSockets, per-instance rate limiting).
