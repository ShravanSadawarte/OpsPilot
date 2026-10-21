# OpsPilot API Reference

All endpoints are versioned Route Handlers under `/api/v1`. Responses use a
consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "requestId": "uuid"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND |
             CONFLICT | VERSION_CONFLICT | IDEMPOTENCY_CONFLICT |
             RATE_LIMITED | WORKFLOW_TRANSITION_INVALID | INTERNAL_ERROR",
    "message": "human-readable message",
    "details": { "field": ["message"] }
  },
  "requestId": "uuid"
}
```

All mutating endpoints (POST/PUT/PATCH/DELETE) require a valid session and a
double-submit CSRF token: the `X-CSRF-Token` header must match the `ops_csrf`
cookie. `GET /api/v1/auth/csrf` returns the current CSRF token.

## Authentication

### POST /api/v1/auth/login
Authenticate a user and establish a session.

**Body**
```json
{ "email": "string", "password": "string" }
```

**Response (200)**
```json
{ "success": true, "data": { "user": { "id","email","name","role" }, "csrfToken": "string" } }
```

Rate-limited per identifier (email or IP); 5 attempts per 5-minute window by
default. Returns 401 on invalid credentials, 429 when rate-limited.

### POST /api/v1/auth/logout
End the current session (requires auth + CSRF).

**Response (200)** `{ "success": true, "data": { "ok": true } }`

### GET /api/v1/auth/me
Return the authenticated user (session restoration). Requires auth.

**Response (200)** `{ "success": true, "data": { "id","email","name","role","isActive" } }`

### GET /api/v1/auth/csrf
Return the current CSRF token (sets/returns the `ops_csrf` cookie).

**Response (200)** `{ "success": true, "data": { "csrfToken": "string" } }`

## Users

### GET /api/v1/users
List active users for staffing. Restricted to ADMIN/MANAGER; managers may use
it to add people to teams they manage. Team leads and members receive 403.

### GET /api/v1/users/me
Alias for auth/me. Returns the current authenticated user.

## Teams

### GET /api/v1/teams
List active teams visible to the caller with membership counts. ADMIN receives
every active team; every other role receives only active team memberships.
Requires auth.

**Query** none

**Response (200)** `{ "data": { "items": [ { "id","key","name","description","isActive","createdAt","memberCount","userRole" } ] } }`

### POST /api/v1/teams
Create a team (ADMIN/MANAGER only). Requires auth + CSRF.

**Body** `{ "key": "string", "name": "string", "description?: "string" }`

**Response (201)** `{ "data": { "id","key","name","description","isActive","createdAt" } }`

### GET /api/v1/teams/[id]?teamId=...
Get a team with memberships (caller must be a member or have manage rights).
Returns 404 (not 403) to avoid leaking existence across teams.

### PATCH /api/v1/teams/[id]?teamId=...
Update a team (manage rights required). Requires auth + CSRF.

**Body** `{ "key?: "string", "name?: "string", "description?: "string" }`

### POST /api/v1/teams/[id]/members?teamId=...&userId=...
Add a member or change a team role. Only ADMIN/MANAGER may call this
(manage rights in the team are also required). A team lead can remove ordinary
members but cannot add members or grant roles. Requires auth + CSRF.

**Body** `{ "userId": "uuid", "role": "TEAM_LEAD|TEAM_MEMBER|MEMBER" }`

`ADMIN` and `MANAGER` are global roles and are rejected as team roles.

### DELETE /api/v1/teams/[id]/members?teamId=...&userId=...
Remove/deactivate a member (manage rights required). Requires auth + CSRF.
A caller cannot remove themselves, a platform ADMIN (unless the caller is an
ADMIN), or a member whose effective authority is equal/higher than their own.
Only a platform ADMIN bypasses this hierarchy.

### GET /api/v1/teams/[id]/overview?teamId=...
Team-scoped work overview (total, by status, by priority, recent items).
Requires membership or manage rights.

## Work items

### GET /api/v1/work-items
List work items with server-side filtering, sorting, and pagination. Scope is
restricted to teams the caller can see.

**Query**
- `page` (int, default 1), `pageSize` (int, max 100, default 20)
- `sort` (field, default `updatedAt`), `order` (`asc`|`desc`, default `desc`)
- `teamId`, `status`, `priority`, `type`, `assigneeId`, `reporterId`, `search`,
  `dueDate`, `overdue` (`"true"`|`"false"`)

**Response (200)** `{ "data": { "items": [WorkItem], "meta": { "page","pageSize","total","totalPages" } } }`

### POST /api/v1/work-items
Create a work item. Supports `Idempotency-Key`; the server derives a SHA-256
fingerprint from the validated payload (never from a client header). An
identical replay returns `200` with the original item; reusing the key with a
different payload returns `409 IDEMPOTENCY_CONFLICT`. Requires auth + CSRF.

**Body**
```json
{
  "title": "string",
  "description?": "string",
  "type": "INCIDENT|CUSTOMER_ISSUE|ENGINEERING_TASK|PAYMENT_INVESTIGATION|COMPLIANCE_REQUEST|OPERATIONAL_TASK",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "teamId": "uuid",
  "assigneeId?": "uuid",
  "dueDate?": "datetime"
}
```

If `assigneeId` is supplied, the target must be an active member of `teamId`.
Requires `canCreateWorkItem` (ADMIN or an active team member).

**Response (201)** the created work item.
Identical retries with the same `Idempotency-Key` return the stored result.
Key reuse with a different payload returns 409 `IDEMPOTENCY_CONFLICT`.

### GET /api/v1/work-items/[id]?workItemId=...
Get a single work item (caller must see its team). Returns 404 if not visible.

### PATCH /api/v1/work-items/[id]?workItemId=...
Update permitted metadata fields. Requires `version` in the body (optimistic
concurrency). Requires auth + CSRF.

**Body**
```json
{
  "title?": "string", "description?": "string", "type?", "priority?",
  "assigneeId?": "uuid|null", "dueDate?", "version": <int>
}
```

- `status` is rejected with 400. Use the workflow transition endpoint.
- Changing `assigneeId` requires assignment permission (team lead, manager, or
  ADMIN) and the target must be an active member of the item's team.
- A stale `version` returns 409 `VERSION_CONFLICT`.
- Unknown fields, including client-supplied `reporterId`/`teamId`, are rejected.

### POST /api/v1/work-items/[id]?workItemId=  (transition)
Transition status. Body `{ "status": "...", "version": <int> }`. Invalid
transitions return 400 `WORKFLOW_TRANSITION_INVALID`; stale version returns 409.

### POST /api/v1/work-items/[id]/assign?workItemId=  (assign)
Assign/unassign. Body `{ "assigneeId": "uuid|null", "version": <int> }`.
Target must be an active member of the item's team. Stale version returns 409.

### POST /api/v1/work-items/[id]/claim?workItemId=  (claim)
Atomically claim an unassigned work item. Body `{ "version": <int> }`.
Only one claim succeeds; concurrent claims: one gets 409 `CONFLICT`.

### POST /api/v1/work-items/[id]/comments?workItemId=  (add comment)
Body `{ "body": "string" }`. Requires auth + CSRF. Returns 201.

### GET /api/v1/work-items/[id]/comments?workItemId=  (list comments)
Paginated comments for a work item.

### GET /api/v1/work-items/[id]/activity?workItemId=  (activity timeline)
Paginated activity events for a work item (actor + timestamp + type).

## Approvals

### GET /api/v1/approvals
List pending approvals scoped to teams the caller can see (ADMIN sees all).
The queue is visible to team members, but only team leads/managers and ADMIN can
decide an item.

### POST /api/v1/approvals
Request an approval for a work item. Body `{ "workItemId": "uuid" }`.
Requires auth + CSRF. One pending approval per work item; concurrent requests
are serialized and the loser gets 409 `CONFLICT`. A member may request approval
for work they reported; team leads/managers may request for team work.

### GET /api/v1/approvals/[id]?approvalId=...
Get an approval with its work item, requester, and decider.

### POST /api/v1/approvals/[id]?approvalId=...  (decide)
Approve or reject. Body `{ "status": "APPROVED|REJECTED", "reason?": "string" }`.
Rejection requires a reason. Deciding your own request is forbidden for every
role, including ADMIN/MANAGER. The decider must be ADMIN or have manager/lead
authority in the item's team; cross-team callers get 404. Atomic conditional
update ensures only one concurrent decision succeeds; the loser gets 409
`CONFLICT`, and the decision plus its `ActivityEvent` are committed together.

## Dashboard

### GET /api/v1/dashboard
Permission-scoped metrics computed in PostgreSQL:
`openWork`, `criticalHighWork`, `overdueWork`, `unassignedWork`, `myWork`,
`pendingApprovals`, `recentActivity`, `statusSummary`, `prioritySummary`,
`attentionRequired`.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Invalid request body/query |
| UNAUTHENTICATED | 401 | No valid session |
| FORBIDDEN | 403 | Authenticated but not permitted |
| NOT_FOUND | 404 | Missing resource (or cross-team non-disclosure) |
| CONFLICT | 409 | Generic conflict (e.g. already assigned) |
| VERSION_CONFLICT | 409 | Optimistic concurrency stale version |
| IDEMPOTENCY_CONFLICT | 409 | Idempotency key reused with different payload |
| RATE_LIMITED | 429 | Login rate limit exceeded |
| WORKFLOW_TRANSITION_INVALID | 400 | Status transition not allowed |
| INTERNAL_ERROR | 500 | Unexpected server error |
