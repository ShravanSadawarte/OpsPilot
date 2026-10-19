# Known Limitations

This document lists features that are unimplemented, partially implemented, or
deferred in OpsPilot. It is maintained honestly alongside the implementation.

## Partially implemented

1. **Frontend conflict reconciliation (requirement F)**
   - The edit page detects HTTP 409 `VERSION_CONFLICT`, preserves the user's
     unsaved edits, and offers a "Refresh" button that reloads server state.
     A richer "reapply your changes" merge UI is not implemented — refreshing
     discards local edits, which the user must re-enter.

2. **Idempotency cleanup**
   - `IdempotencyRecord` rows are never purged. A TTL or periodic cleanup job
     is not implemented; the table grows unbounded over time.

3. **Login rate limiting**
   - The rate-limit store is an in-memory `Map` per serverless instance. In a
     multi-instance production deployment it does not share state across
     instances. Backing it with Redis is future work.

4. **Email delivery / password reset**
   - There is no email provider integration. Password reset flows and email
     notifications are not implemented.

## Unimplemented

5. **Real-time collaboration / WebSockets**
   - Comments and activity are polled or loaded on page navigation; there is no
     live-update channel (serverless does not support WebSockets natively).

6. **Background jobs / queues**
   - No background processing is implemented (optional per the mandate). No
     retry/idempotency semantics for a managed queue are defined.

7. **Playwright end-to-end tests**
   - Playwright is listed in the stack but no E2E test files are written.
     Critical user flows are covered by unit and service-layer integration
     tests only.

8. **Team creation page UI**
   - The teams list page exists; the "Create team" button currently has no
     destination route/form (team creation is available via the API only).

9. **Advanced filtering UI controls**
   - The work-item list supports status/priority/type/search filters and
     pagination; assignee filtering, due-date range filtering, and saved views
     are not in the UI.

10. **User profile/settings page**
    - The settings route is referenced in navigation structure but no settings
      page is implemented (password change, profile editing).

11. **File attachments**
    - Work items and comments cannot have attachments.

12. **OpenAPI spec file**
    - `docs/API.md` documents the implemented endpoints in prose. A
      machine-readable OpenAPI/YAML spec is not generated.

13. **Image/file upload and storage**
    - No object-storage integration (e.g., S3/Vercel Blob).

14. **Audit event export / immutable log shipping**
    - Activity events are append-only but there is no export or external
      immutability verification.

15. **Two-factor authentication (2FA)**
    - Not implemented.

16. **Organization-level multi-tenancy beyond teams**
    - Authorization is team-scoped; there is no separate organization
      abstraction above teams.

## Tests not runnable in this environment

- Integration tests (`tests/integration/correctness.test.ts`) require a live
  PostgreSQL test database (`DATABASE_URL_TEST`) and are skipped here because
  no managed PostgreSQL instance is provisioned. They must be executed against
  a test database before a release.

## Test coverage note

Unit tests cover the workflow transition map and role-weight authorization.
Service-layer integration tests for the critical correctness behaviors
(optimistic concurrency, idempotency, transactional audit, atomic assignment,
concurrent approvals) are written but require a test database to execute.
