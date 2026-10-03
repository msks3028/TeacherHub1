const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepareDatabaseConnection } = require("../scripts/prepare-db-connection");

describe("backup PostgreSQL connection preparation", () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), "teacherhub-backup-test-")); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  test("removes credentials and Prisma-only parameters from the connection URL", () => {
    const passFilePath = path.join(directory, ".pgpass");
    const result = prepareDatabaseConnection(
      "postgresql://backup-user:temporary-test-password@db.example.test:5433/teacherhub?schema=public&sslmode=require&password=query-secret",
      passFilePath,
    );
    expect(result.connectionString).not.toContain("temporary-test-password");
    expect(result.connectionString).not.toContain("query-secret");
    expect(result.connectionString).not.toContain("schema=");
    expect(result.connectionString).toContain("sslmode=require");
    expect(fs.readFileSync(passFilePath, "utf8")).toContain("temporary-test-password");
  });

  test("escapes separators in passfile credentials", () => {
    const passFilePath = path.join(directory, ".pgpass");
    prepareDatabaseConnection("postgresql://backup-user:p%3Aa%5Css@db.example.test/teacherhub", passFilePath);
    expect(fs.readFileSync(passFilePath, "utf8")).toContain("p\\:a\\\\ss");
  });
});
