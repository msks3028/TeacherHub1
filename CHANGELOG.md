# Changelog

## 2026-09-27 — Existing project hardening

- Added a server-authorized LiveKit room flow, role-scoped room tokens, signed webhook handling, and verified attendance tracking.
- Added notification categories/preferences, bounded notification pagination, deduplication, and scheduled reminders.
- Improved AI request bounds and course ownership checks; student AI now refuses to present course metadata as lesson content when source text is unavailable.
- Improved existing session/2FA protections, course unit ordering, analytics scoping, PWA reconnect behavior, and backup credential handling/verification.
- Added a server-detected new-device login alert with a coarse browser label; sensitive IP details stay in the session record rather than the notification.
- Added user-confirmed PWA updates in the existing service worker, and native drag-and-drop lesson reordering within a unit while retaining keyboard controls.
- Removed request query strings and upload field details from public error responses/log context.
- Extended the teacher analytics response and existing page with a date/course-scoped per-student summary from database events; the API filters students to the authenticated teacher's ownership.
- Tightened PDF upload signature screening and added focused MIME-spoof tests.
- Added a new Prisma migration for live class and notification changes. Existing migrations were left unchanged.
- Added targeted tests for LiveKit permissions/webhooks, CSRF checks, password-gated 2FA activation, and backup connection handling.

This changelog describes source changes, not production deployment or external-service verification.
