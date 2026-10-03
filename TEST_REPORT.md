# Test report — 2026-09-27

## Executed

- Backend Jest: **12 suites passed, 67 tests passed**.
- Babel parser: **184 backend/frontend source, test, and script files parsed** after upload validation tests.
- Frontend production build: **passed** (`npm run build`). Vite reports the existing LiveClassRoomPage output chunk at about 573 kB minified; build splitting/size warning remains.
- Prisma schema validation: **passed** with a dummy local `DATABASE_URL`; no real database was contacted.
- Prisma client generation: **passed** with the project-local Prisma CLI.
- PowerShell parser checks: backup and backup-verification scripts parsed successfully.
- `npm audit`: frontend and backend checks reported zero known vulnerabilities at the time run.
- Service-worker JavaScript syntax check and manifest JSON parse: **passed** (one worker source, two manifest icons).
- Archive check: 222 source/documentation files; excluded runtime `.env`, dependency, upload, log, build, and cache paths.

## Not executed or not verified

- `prisma migrate deploy` / migration diff against PostgreSQL: not run; no test database credentials were available.
- Browser/E2E coverage: not run, including install/offline, push notifications, authentication, and live room flows.
- Native drag-and-drop interaction and PWA update activation were not exercised in a browser.
- The new per-student analytics aggregation has no dedicated database integration test; ownership/date/course predicates were reviewed in code only.
- LiveKit, Groq, email, Web Push, object storage, and PostgreSQL integrations: not contacted.
- Backup creation and restore rehearsal: not run because PostgreSQL client tools and an isolated database/storage target were not available.

Passing unit tests do not establish end-to-end or production readiness.
