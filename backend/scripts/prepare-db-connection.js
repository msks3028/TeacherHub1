const fs = require("node:fs");
const path = require("node:path");

const LIBPQ_PARAMETERS = new Set([
  "sslmode", "sslrootcert", "sslcert", "sslkey", "sslcrl", "connect_timeout",
  "application_name", "target_session_attrs", "channel_binding",
]);

function escapePassfileField(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/\r|\n/g, "");
}

function prepareDatabaseConnection(databaseUrl, passFilePath) {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) throw new Error("DATABASE_URL must identify a PostgreSQL host.");
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!username || !database) throw new Error("DATABASE_URL must include a database name and username.");

  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  const port = parsed.port || "5432";
  const passFile = [host, port, database, username, password].map(escapePassfileField).join(":") + "\n";
  fs.writeFileSync(passFilePath, passFile, { encoding: "utf8", flag: "wx", mode: 0o600 });

  const safeUrl = new URL(parsed.href);
  safeUrl.username = "";
  safeUrl.password = "";
  for (const key of [...safeUrl.searchParams.keys()]) {
    if (key.toLowerCase() === "schema") safeUrl.searchParams.delete(key); // Prisma-only setting, not a libpq URL option.
    else if (!LIBPQ_PARAMETERS.has(key.toLowerCase())) safeUrl.searchParams.delete(key);
  }
  return { connectionString: safeUrl.href, username, passFilePath };
}

if (require.main === module) {
  try {
    const passFilePath = process.argv[2];
    if (!passFilePath || !process.env.DATABASE_URL) throw new Error("Missing database connection configuration.");
    process.stdout.write(JSON.stringify(prepareDatabaseConnection(process.env.DATABASE_URL, path.resolve(passFilePath))));
  } catch {
    // Never echo a URL or a parser exception that could include credential data.
    console.error("Could not prepare a secure PostgreSQL backup connection.");
    process.exitCode = 1;
  }
}

module.exports = { prepareDatabaseConnection, escapePassfileField };
