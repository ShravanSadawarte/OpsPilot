# OpsPilot Security

## Authentication

OpsPilot uses custom session-based authentication (a documented decision;
see `ENGINEERING_DECISIONS.md`).

- **Passwords** are hashed with Argon2id using the `argon2` library. No custom
  cryptography is implemented; plaintext passwords are never stored.
- **Sessions** use a persistent strategy: a random session token is issued on
  login, stored as a SHA-256 hash in the database, and sent to the client in an
  `HttpOnly` `SameSite` cookie (`ops_session`). JavaScript cannot read the raw
  token.
- **Session validation** happens on every request: expiration, revocation, and
  user active status are checked. Expired sessions are revoked and treated as
  unauthenticated.
- **Login rate limiting**: failed login attempts are counted per identifier
  (email or IP); exceeding the threshold returns 429. The in-memory store is
  per serverless instance (see limitations).
- **CSRF**: mutating endpoints require a double-submit token — the
  `X-CSRF-Token` header must equal the `ops_csrf` cookie (non-HttpOnly,
  readable by the SPA).

## Authorization

Authorization is enforced at the server boundary in the domain service layer,
not only in middleware or hidden UI controls.

- **Roles**: ADMIN, MANAGER, MEMBER, TEAM_LEAD, TEAM_MEMBER. ADMIN/MANAGER have
  cross-team authority; TEAM_LEAD/TEAM_MEMBER are scoped to team memberships.
  The effective role within a team is the heavier of the global role and the
  team membership role.
- **Centralized `can*` functions** (`canViewWorkItem`, `canCreateWorkItem`,
  `canEditWorkItem`, `canAssignWorkItem`, `canTransitionWorkItem`,
  `canManageTeam`, `canRequestApproval`, `canDecideApproval`) are used by all
  protected data-access operations.
- **Client input is never trusted**: user IDs, roles, reporter IDs, and team
  assignments supplied by the browser are ignored; identity comes from the
  validated session.
- **Cross-team leakage**: work items and teams are scoped to teams the caller
  can see. 404 (not 403) is returned for resources outside the caller's teams
  to avoid disclosing existence.

## Resource-disclosure policy

- `404 NOT_FOUND` — the caller must not learn whether the resource exists
  (used for cross-team reads of work items/teams).
- `403 FORBIDDEN` — the resource exists but the caller is not permitted to act
  (used for mutations on visible-but-not-modifiable resources).

## Data protection

- Session cookies are `HttpOnly`, `SameSite=Lax` (default), and `Secure` in
  production (`SESSION_COOKIE_SECURE=true`).
- No database URLs or secrets use `NEXT_PUBLIC_` prefixes; none reach the
  client bundle.
- Protected responses carry `Cache-Control: private, no-store, no-cache,
  must-revalidate, proxy-revalidate` so personal/authorization-sensitive data
  is not cached by browsers or CDNs.
- Audit history (`ActivityEvent`) is append-only and not subject to cascade
  deletion.

## Threat model & mitigations

| Threat | Mitigation |
|---|---|
| Credential stuffing / brute force | Login rate limiting (429) + Argon2id hashing |
| Session theft | HttpOnly cookies + short TTL + revocation |
| CSRF on cookie mutations | Signed double-submit `X-CSRF-Token` (HMAC-SHA256, `AUTH_SECRET`) |
| Privilege escalation | Server-side `can*` revalidation on every mutation |
| Cross-team data leakage | Team-scoped queries + 404 non-disclosure |
| Stale overwrites (lost updates) | Optimistic concurrency (`version` + conditional update) → 409 |
| Duplicate creation | `Idempotency-Key` + unique constraint + fingerprint |
| Conflicting approvals | Atomic conditional decision → one succeeds, other 409 |
| Missing audit events | Mutations + ActivityEvent in same transaction |

## Deployment security

- Set `NODE_ENV=production` and `SESSION_COOKIE_SECURE=true` on Vercel.
- Provide `DATABASE_URL` (pooled) and `DATABASE_URL_DIRECT` (direct) via
  Vercel environment variables, never in the repo.
- Run migrations as an explicit release step (`prisma migrate deploy`).
- `AUTH_SECRET` is validated lazily: missing values fail at runtime with a
  clear error instead of breaking `next build`. Rotate it if compromised;
  this invalidates outstanding CSRF tokens (sessions are revoked separately).
- Sessions are random 256-bit tokens stored as SHA-256 hashes; `AUTH_SECRET`
  does not protect session tokens and rotating it does not invalidate them.

## Limitations

- Login rate limiting is in-memory per serverless instance; multi-instance
  production should back it with Redis.
- No email provider, so no password-reset emails or 2FA.
- Idempotency records are not purged (unbounded growth).
