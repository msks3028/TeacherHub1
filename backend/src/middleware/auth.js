const { verifyToken } = require("../utils/jwt");
const prisma = require("../config/db");
const { legacyTokenId } = require("../services/sessionService");

/**
 * Verifies the JWT from the Authorization header (or httpOnly cookie),
 * loads the current user from DB (so a disabled account is blocked
 * immediately, not just until the token expires), and attaches it to req.user.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearerToken || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { studentProfile: true, teacherProfile: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Account not found or disabled." });
    }

    // Legacy JWTs from before session inventory are registered on first use;
    // new JWTs carry a JTI. In both cases, session revocation is checked here.
    const tokenId = decoded.jti || legacyTokenId(token);
    const session = await prisma.session.upsert({
      where: { tokenId },
      create: {
        userId: user.id,
        tokenId,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
        ipAddress: String(req.ip || "").slice(0, 64) || null,
        expiresAt: new Date(decoded.exp * 1000),
      },
      update: {},
    });
    if (session.userId !== user.id || session.revokedAt || session.expiresAt <= new Date()) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = user;
    req.authSession = session;
    // Avoid a database write on every API request while still maintaining a
    // useful, reasonably fresh "last active" value in the session list.
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }
    next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Restricts a route to specific roles. Always used server-side —
 * the frontend hiding a button is NEVER sufficient on its own.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}

/**
 * Ensures a student can only ever act on their OWN Student record.
 * Use on any /student/:studentId/* route as an extra guard beyond
 * authorize("STUDENT"), so a student can never pass another student's id.
 */
function ensureSelfStudent(req, res, next) {
  const requestedId = req.params.studentId;
  if (requestedId && requestedId !== req.user.studentProfile?.id) {
    return res.status(403).json({ message: "You cannot access another student's data." });
  }
  next();
}

module.exports = { authenticate, authorize, ensureSelfStudent };
