const prisma = require("../config/db");
const logger = require("../utils/logger");

function audit(req, action, { userId, targetType, targetId, details } = {}) {
  const record = {
    userId: userId || req?.user?.id || null,
    action: String(action).slice(0, 80),
    targetType: targetType ? String(targetType).slice(0, 80) : null,
    targetId: targetId ? String(targetId).slice(0, 128) : null,
    ipAddress: typeof req?.ip === "string" ? req.ip.slice(0, 64) : null,
    userAgent: typeof req?.headers?.["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    details: details && typeof details === "object" ? details : undefined,
  };
  return prisma.auditLog.create({ data: record }).catch((error) => {
    // Auditing should not take the authentication/content API down if storage is unavailable.
    logger.error("Audit record could not be persisted", { action: record.action, error: error.message });
  });
}

module.exports = { audit };
