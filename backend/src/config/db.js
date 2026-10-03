const { PrismaClient } = require("@prisma/client");

// Singleton pattern so we don't exhaust DB connections during dev hot-reloads
const prisma =
  global.__teacherhub_prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__teacherhub_prisma__ = prisma;
}

module.exports = prisma;
