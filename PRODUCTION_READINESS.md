# Production readiness

Statuses distinguish code inspection and automated checks from live integration verification.

| Area | Implementation | Tests | Verification | Status |
|---|---|---|---|---|
| Existing TeacherHub core | Existing auth, teacher/student pages, courses, lessons, exams, homework, materials, video, uploads | Existing test suite run | No full browser journey | PARTIAL — regression QA remains |
| Live Classes | LiveKit room/token/webhook flow, eligibility checks, attendance | Unit tests pass | Provider room/webhook/browser flow not run; Egress recording not implemented | PARTIAL — external integration and recording remain |
| AI | Existing Groq calls, ownership checks, bounded history, DB metrics; course source retrieval is absent | No AI provider integration tests | Provider not configured/verified | PARTIAL — no file extraction or retrieval pipeline |
| Notifications | In-app, push, preferences, pagination, dedupe, reminders; database unique dedupe key makes concurrent reminder runs idempotent | Unit coverage only for adjacent service behavior | Push provider/browser and multi-instance DB race not exercised | PARTIAL |
| PWA/mobile | Existing manifest/one service worker/install UI; offline shell, network-only APIs, user-confirmed update activation | Syntax checked only | Install/offline/reconnect/update not browser-tested | PARTIAL |
| Security | Existing sessions, 2FA, verification, CSRF, rate limiting, upload authorization; new-device alert and generic error responses | Selected unit tests pass | No independent penetration test | PARTIAL — broader IDOR and upload review remains |
| Backups | DB/upload scripts, checksums, retention, archive checks, restore documentation | Connection preparation tests pass | No pg_dump, restore rehearsal, or storage restore performed | PARTIAL — RPO/RTO not established |
| Units/content organization | Unit/lesson relations and persisted ordering, same-unit drag-and-drop plus keyboard fallback | No frontend interaction test | Browser drag/drop and migration/data preservation not DB-tested | PARTIAL |
| Teacher analytics | Real DB-derived aggregate metrics and per-student summaries scoped to teacher ownership, with date/course filters | No dedicated integration test | No live DB verification | PARTIAL — weak-topic/course-unit breakdown and export remain |
| Error handling/observability | Winston logging and generic error response for common failures | No dedicated tests | External alerting/request-ID tracing not verified | PARTIAL |
| Build/deployment | Existing Docker/deployment files preserved | Backend tests pass | Vite build and Prisma generation pass; live DB/deployment not tested | PARTIAL — large LiveClassRoomPage chunk warning remains |

Do not deploy until migrations, build, external service configuration, restore rehearsal, and browser flows have passed in CI/staging.
