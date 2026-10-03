# TeacherHub security operations

## Secret rotation after the supplied archive

The supplied source archive included a local backend environment file. The sanitized project package omits it and contains only `backend/.env.example`. Treat credentials from the supplied archive as exposed and rotate them before running a deployment:

- Replace the PostgreSQL account password and review database access logs.
- Replace the JWT signing secret and revoke active sessions so previously issued tokens cannot be reused.
- Replace AI-provider and LiveKit API credentials, then update the deployment secret store.
- Change any bootstrap or seed account passwords that were included in the local environment.
- Handle `TOTP_ENCRYPTION_KEY` as a staged migration: keep the old key available only to decrypt existing authenticator ciphertext, re-encrypt it under the new key, verify the migration, then retire the old key. If that cannot be done safely, ask users to enroll in two-factor authentication again before removing the old key.

Never copy the original environment file into source control, support tickets, logs, backup archives intended for code delivery, or this sanitized package. Store runtime secrets in the host's secret manager or a private deployment environment.

## Security mechanisms in the project

- Server-side JWT/session validation and revocation, role checks, session inventory, and per-user device logout.
- TOTP two-factor authentication with encrypted stored secrets and single-use recovery codes; enabling and disabling require the current password.
- Audit events record security-sensitive account and content-management actions.
- Cookie-authenticated write requests validate origin/Fetch Metadata; bearer-only API clients remain supported.
- Uploads have per-kind size and MIME checks, content signature checks for supported formats, randomized stored names, protected file routes, and rate limits.
- API, login, AI, file, upload, and security-action routes use rate limits.
- Security headers are applied with Helmet. Sensitive API responses and authentication-bearing UI pages are not cached by the service worker.

Review provider access, retention, and alerting settings during deployment. This document describes application controls; it does not replace provider-side MFA, secret-manager access controls, network restrictions, or incident monitoring.
