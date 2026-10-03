// Fail fast (and loudly) on unsafe configuration instead of running with it.
function checkEnv() {
  const problems = [];
  const warnings = [];
  const isProd = process.env.NODE_ENV === "production";

  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    problems.push("JWT_SECRET is not set.");
  } else if (secret.length < 32) {
    problems.push("JWT_SECRET is too short — use at least 32 random characters.");
  } else if (/change|replace|placeholder|secret|example|your[-_ ]|password|123456/i.test(secret)) {
    const msg =
      "JWT_SECRET looks like a placeholder. Generate a real one with:\n" +
      "    node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"";
    (isProd ? problems : warnings).push(msg);
  }

  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set.");
  if (isProd && !process.env.CLIENT_URL) problems.push("CLIENT_URL must be set in production (used for CORS and QR links).");
  if (process.env.CLIENT_URL) {
    try {
      const clientUrl = new URL(process.env.CLIENT_URL);
      if (clientUrl.username || clientUrl.password || !["http:", "https:"].includes(clientUrl.protocol)) problems.push("CLIENT_URL must be an HTTP(S) origin without credentials.");
      if (isProd && clientUrl.protocol !== "https:") problems.push("CLIENT_URL must use HTTPS in production.");
    } catch { problems.push("CLIENT_URL must be a valid HTTP(S) URL."); }
  }
  if (isProd && !process.env.TOTP_ENCRYPTION_KEY) problems.push("TOTP_ENCRYPTION_KEY must be set in production and kept stable across JWT secret rotations.");
  if (process.env.TOTP_ENCRYPTION_KEY && process.env.TOTP_ENCRYPTION_KEY.length < 32) problems.push("TOTP_ENCRYPTION_KEY must contain at least 32 characters.");
  if (!!process.env.VAPID_PUBLIC_KEY !== !!process.env.VAPID_PRIVATE_KEY) {
    problems.push("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must either both be set or both be empty.");
  }

  const storageDriver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (!["local", "s3"].includes(storageDriver)) problems.push("STORAGE_DRIVER must be either 'local' or 's3'.");
  if (storageDriver === "s3" && !process.env.STORAGE_BUCKET) problems.push("STORAGE_BUCKET is required when STORAGE_DRIVER=s3.");
  if (!!process.env.STORAGE_ACCESS_KEY_ID !== !!process.env.STORAGE_SECRET_ACCESS_KEY) {
    problems.push("STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY must either both be set or both be empty.");
  }
  if (process.env.STORAGE_ENDPOINT) {
    try {
      const endpoint = new URL(process.env.STORAGE_ENDPOINT);
      if (!endpoint.hostname || endpoint.username || endpoint.password || !["http:", "https:"].includes(endpoint.protocol)) problems.push("STORAGE_ENDPOINT must be an HTTP(S) URL without credentials.");
    } catch { problems.push("STORAGE_ENDPOINT must be a valid HTTP(S) URL."); }
  }

  const liveKitValues = [process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET];
  const liveKitConfiguredCount = liveKitValues.filter(Boolean).length;
  if (liveKitConfiguredCount > 0 && liveKitConfiguredCount < liveKitValues.length) problems.push("LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be configured together.");
  if (isProd && liveKitConfiguredCount !== liveKitValues.length) problems.push("LiveKit credentials must be configured in production for in-platform live classes.");
  if (liveKitConfiguredCount === liveKitValues.length) {
    try {
      const liveKitUrl = new URL(process.env.LIVEKIT_URL);
      if (liveKitUrl.username || liveKitUrl.password || !["wss:", "https:"].includes(liveKitUrl.protocol) && isProd) problems.push("LIVEKIT_URL must use wss:// or https:// in production and must not contain credentials.");
      if (!["wss:", "ws:", "https:", "http:"].includes(liveKitUrl.protocol)) problems.push("LIVEKIT_URL must use a WebSocket or HTTPS protocol.");
    } catch { problems.push("LIVEKIT_URL must be a valid provider URL."); }
  }

  warnings.forEach((w) => console.warn(`\n⚠️  SECURITY WARNING: ${w}\n`));
  if (problems.length) {
    console.error("\n❌ Refusing to start because of unsafe configuration:");
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error("");
    process.exit(1);
  }
}

module.exports = { checkEnv };
