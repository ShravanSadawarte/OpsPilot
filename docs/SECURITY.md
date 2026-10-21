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
not only in middleware or hidden UI controls. The database has no organization
tenant, so **the team is the resource boundary**. ADMIN is the only
platform-wide role.

### Roles and effective authority

| Role | Scope | Team authority |
|---|---|---|
| ADMIN | All active teams | Platform-wide read/admin; may manage any team and decide any approval except their own |
| MANAGER | Active team memberships only | Team manager in those teams; no authority in other teams |
| TEAM_LEAD | Active team memberships only | Team manager in those teams; no authority in other teams |
| MEMBER | Active team memberships only | Baseline member; edits/transitions work they reported or are assigned |
| TEAM_MEMBER | Active team memberships only | Baseline member; edits/transitions work they reported or are assigned |

- The effective role inside a team is the heavier of the global role and the
  sanitized team membership role. **No active membership means no standing in
  that team**, except for a global ADMIN.
- A team membership may only contain `TEAM_LEAD`, `TEAM_MEMBER`, or `MEMBER`.
  `ADMIN` and `MANAGER` are global identities and cannot be granted through the
  team API. Legacy elevated membership values are treated as `TEAM_MEMBER` for
  authorization.
- Only ADMIN/MANAGER may add members or assign team roles. A team lead can
  remove ordinary members from their own team but cannot grant roles, remove
  themselves, remove a platform admin, or remove a member whose effective
  authority (global or team role) is equal/higher.
- **Centralized `can*` functions** (`canViewWorkItem`, `canCreateWorkItem`,
  `canEditWorkItem`, `canAssignWorkItem`, `canTransitionWorkItem`,
  `canManageTeam`, `canRequestApproval`, `canDecideApproval`) and the explicit
  `TEAM_ROLE_CAPABILITIES` map are used by all protected data-access
  operations. Missing/unknown roles deny by default.
- **Self-approval is denied for every role**, including ADMIN and MANAGER.
- **Client input is never trusted**: user IDs, roles, reporter IDs, assignee
  IDs, and team IDs supplied by the browser are ignored or revalidated; identity
  comes from the validated session. Request schemas are strict, so unknown
  ownership/status fields are rejected rather than silently accepted.
- **Status changes** only use the workflow transition operation. The metadata
  PATCH endpoint rejects `status`; assignment changes on PATCH require the
  assignment permission.
- **Cross-team leakage**: work items, teams, approvals, lists, and dashboard
  metrics are scoped to teams the caller can see. 404 (not 403) is returned for
  resources outside the caller's teams to avoid disclosing existence.

### Team membership and global roles

There is no user-administration endpoint for changing `User.role`. Global role
changes are an operational/database procedure performed by an administrator,
not a browser action. Team-role assignment is the only role-granting API, and
it is restricted as described above.

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
- Work-item history (`ActivityEvent`) is append-only and records work-item
  changes, approval requests, and approval decisions. Approval decisions and
  their audit event are written in the same transaction.

## Threat model & mitigations

| Threat | Mitigation |
|---|---|
| Credential stuffing / brute force | Login rate limiting (429) + Argon2id hashing |
| Session theft | HttpOnly cookies + short TTL + revocation |
| CSRF on cookie mutations | Signed double-submit `X-CSRF-Token` (HMAC-SHA256, `AUTH_SECRET`) |
| Privilege escalation | Server-side `can*` revalidation + team-only role grants |
| Cross-team data leakage | Membership-scoped queries, ADMIN-only global override, 404 non-disclosure |
| Self-approval | Explicit `requestedById === user.id` denial before role checks |
| Stale overwrites (lost updates) | Optimistic concurrency (`version` + conditional update) → 409 |
| Duplicate creation | `Idempotency-Key` + unique constraint + fingerprint |
| Conflicting approvals | Atomic conditional decision → one succeeds, other 409 |
| Missing approval audit events | Decision + `ActivityEvent` in same transaction |

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

- There is no organization/tenant model. A global ADMIN is intentionally
  platform-wide; all other roles are isolated by team membership.
- ADMIN/MANAGER can browse the active user directory (`GET /api/v1/users`) to
  staff teams. This is directory data, not work-item or approval data.
- Team membership/role changes are authorization-sensitive but do not have a
  dedicated persistent audit table in the current schema. Work-item and
  approval mutations are recorded in `ActivityEvent`. Add a general audit log
  before treating team-role changes as compliance-audited events.
- Login rate limiting is in-memory per serverless instance; multi-instance
  production should back it with Redis.
- No email provider, so no password-reset emails or 2FA.
- Idempotency records are not purged (unbounded growth).
