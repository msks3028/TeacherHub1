const crypto = require("crypto");
const prisma = require("../config/db");
const { signToken, verifyToken } = require("../utils/jwt");

function legacyTokenId(token) {
  return `legacy-${crypto.createHash("sha256").update(token).digest("hex")}`;
}

function safeDeviceLabel(userAgent = "") {
  if (/edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/opr\//i.test(userAgent)) return "Opera";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return "Chrome";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
  return "متصفح جديد";
}

async function issueSession(req, userId, role) {
  const userAgent = String(req?.headers?.["user-agent"] || "").slice(0, 500) || null;
  const ipAddress = String(req?.ip || "").slice(0, 64) || null;
  const now = new Date();
  const previous = userAgent && ipAddress ? await prisma.session.findFirst({
    where: { userId, userAgent, ipAddress, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  }) : null;
  const token = signToken({ userId, role });
  const decoded = verifyToken(token);
  const expiresAt = new Date(decoded.exp * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenId: decoded.jti,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });
  return { token, isNewDevice: !previous, deviceLabel: safeDeviceLabel(userAgent || "") };
}

module.exports = { issueSession, legacyTokenId, safeDeviceLabel };
