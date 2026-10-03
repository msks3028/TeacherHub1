# Security audit status

## Changes in this continuation

- LiveKit tokens are room-scoped; student publish permissions are limited to camera and microphone. Teacher room administration is assigned server-side.
- LiveKit webhook signatures are verified and provider event IDs are stored for idempotency. Attendance is updated from verified provider events, not from a client join button.
- Student/teacher AI access checks continue to scope course and conversation access server-side. Student AI now states when lesson/file text is not present rather than treating metadata as source material.
- Login session creation compares the active session's exact user-agent and IP pair and emits a security notification with only a coarse browser label for a new pair. IP remains in the existing session metadata, not the notification body.
- Unknown-route and upload error responses no longer echo request query strings or user-supplied upload field details.
- Generic uploads now require a PDF signature within the first 1024 bytes; the upload tests also cover a spoofed PNG MIME header. This is signature screening, not a full parser/malware scan.
- The existing password-gated 2FA activation and CSRF checks have targeted tests. Backup scripts use a temporary PostgreSQL passfile instead of a command-line password.
- The delivered source archive omits runtime environment files and local uploads/logs/dependencies.

## Findings and remaining work

- The provided source archive included a backend environment file. Rotate database, JWT, AI-provider, push, and LiveKit credentials before deployment; handle TOTP key rotation as a planned re-encryption or re-enrollment operation. See `docs/security-operations.md`.
- No full route-by-route IDOR test matrix, upload fuzzing, penetration test, or dependency policy review was performed. The new-device comparison is a heuristic; IP changes, privacy proxies, or browser updates can cause an existing user to be classified as new.
- Build and database-backed migration verification could not run in this environment. Cross-user access must be exercised against a disposable staging database.
- Audit whether request/error logs can include sensitive query strings or provider details before connecting an external log sink. Never send secrets in diagnostic bundles.

## Verification boundary

Targeted unit tests passed. This is not a security certification or claim that every authorization boundary has been tested.
