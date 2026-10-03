# Pre-release checklist

Local code checks completed in this task:

- [x] Backend Jest suite: 64 tests pass.
- [x] Frontend production build passes.
- [x] Prisma schema validation and client generation pass.
- [x] Production dependency audits report no known vulnerabilities.
- [x] One service-worker source parses; manifest JSON parses.

Required staging/production checks:

- [ ] Configure environment variables in a secret manager; rotate credentials from the supplied archive.
- [ ] Apply the new additive migration to a disposable database and verify existing data is preserved.
- [ ] Create a backup, verify its off-host copy, and rehearse restore into isolated database and storage.
- [ ] Measure and approve backup frequency, RPO, and RTO.
- [ ] Configure LiveKit and verify teacher/student room, webhook, and attendance flows with real credentials.
- [ ] Configure and test VAPID/Web Push and email delivery.
- [ ] Configure AI and verify current behavior; do not represent material files as AI-grounded until extraction/retrieval is implemented.
- [ ] Browser-test install, offline shell, reconnect, update approval, uninstall/reinstall, and push interactions.
- [ ] Browser-test drag reordering and analytics filters with teacher/student accounts from separate teacher tenants.
- [ ] Run route-level IDOR, upload abuse, and session/2FA tests against isolated test data.
- [ ] Decide whether private LiveKit recording is required; Egress recording is not implemented.
- [ ] Review the large LiveClassRoomPage build chunk and decide whether further splitting is needed.
- [ ] Run the full CI/E2E suite and sign off before production rollout.
