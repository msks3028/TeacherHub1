const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const { isString } = require("../utils/validate");
const { verifyToken } = require("../utils/jwt");
const { issueSession, legacyTokenId } = require("../services/sessionService");
const { verifySecondFactor } = require("../services/securityService");
const { audit } = require("../services/auditService");
const { notifyUser } = require("../services/notificationService");

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS,
  };
}

// Hash of a throw-away password. When the email doesn't exist we still run a
// bcrypt comparison against it, so "unknown email" and "wrong password" take
// the same time and can't be told apart by timing (user enumeration).
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", 12);

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    twoFactorEnabled: !!user.twoFactorEnabled,
    profile:
      user.role === "TEACHER"
        ? user.teacherProfile
        : {
            id: user.studentProfile?.id,
            fullName: user.studentProfile?.fullName,
            grade: user.studentProfile?.grade,
            group: user.studentProfile?.group,
            avatarUrl: user.studentProfile?.avatarUrl,
          },
  };
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password, twoFactorCode } = req.body || {};

  if (!isString(email, { min: 1, max: 254 }) || !isString(password, { min: 1, max: 200 })) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { teacherProfile: true, studentProfile: true },
  });

  // Same generic message (and same work) whether the email doesn't exist, the
  // account is disabled, or the password is wrong.
  const match = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !user.isActive || !match) {
    audit(req, "login_failed", { userId: user?.id, details: { reason: "invalid_credentials" } });
    return res.status(401).json({ message: "Invalid email or password." });
  }

  if (user.twoFactorEnabled && !(await verifySecondFactor(user, twoFactorCode))) {
    return res.status(401).json({ code: "TWO_FACTOR_REQUIRED", message: "أدخل رمز تطبيق المصادقة أو رمز استرداد صالحًا." });
  }

  if (user.role === "STUDENT") {
    await prisma.student.update({
      where: { userId: user.id },
      data: { lastActiveAt: new Date() },
    });
  }

  const session = await issueSession(req, user.id, user.role);
  audit(req, "login_succeeded", { userId: user.id, targetType: "session" });
  await notifyUser(user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: session.isNewDevice ? "تسجيل دخول من جهاز جديد" : "تسجيل دخول جديد", body: session.isNewDevice ? `تم إنشاء جلسة من متصفح ${session.deviceLabel}. إذا لم يكن ذلك أنت، راجع الجلسات وأنهِ الجلسة غير المعروفة.` : "تم تسجيل الدخول إلى حسابك في TeacherHub.", link: user.role === "TEACHER" ? "/teacher/security" : "/student/security" });

  res.cookie("token", session.token, cookieOptions()).json({ token: session.token, user: serializeUser(user) });
}

// POST /api/auth/qr-login  { qrCodeToken }
// Convenience login for students scanning their printed QR code.
// Still issues a REAL session for a REAL account — it is not a bypass
// of auth, just an alternate way to present valid credentials.
async function qrLogin(req, res) {
  const { qrCodeToken, twoFactorCode } = req.body || {};
  if (!isString(qrCodeToken, { min: 1, max: 100 })) {
    return res.status(400).json({ message: "QR code token is required." });
  }

  const student = await prisma.student.findUnique({
    where: { qrCodeToken },
    include: { user: { include: { studentProfile: true, teacherProfile: true } } },
  });

  if (!student || !student.user.isActive) {
    return res.status(401).json({ message: "Invalid or expired QR code." });
  }
  if (student.user.twoFactorEnabled && !(await verifySecondFactor(student.user, twoFactorCode))) {
    return res.status(401).json({ code: "TWO_FACTOR_REQUIRED", message: "أدخل رمز تطبيق المصادقة أو رمز استرداد صالحًا." });
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { lastActiveAt: new Date() },
  });

  const session = await issueSession(req, student.user.id, "STUDENT");
  audit(req, "qr_login_succeeded", { userId: student.user.id, targetType: "session" });
  await notifyUser(student.user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: session.isNewDevice ? "تسجيل دخول من جهاز جديد" : "تسجيل دخول برمز QR", body: session.isNewDevice ? `تم إنشاء جلسة من متصفح ${session.deviceLabel} عبر رمز QR. إذا لم يكن ذلك أنت، راجع الجلسات وأنهِ الجلسة غير المعروفة.` : "تم تسجيل الدخول إلى حسابك عبر رمز QR.", link: "/student/security" });

  res.cookie("token", session.token, cookieOptions()).json({ token: session.token, user: serializeUser(student.user) });
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: serializeUser(req.user) });
}

// POST /api/auth/logout
async function logout(req, res) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : req.cookies?.token;
  if (token) {
    try {
      const decoded = verifyToken(token);
      const tokenId = decoded.jti || legacyTokenId(token);
      const revoked = await prisma.session.updateMany({
        where: { tokenId, userId: decoded.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count) audit(req, "logout", { userId: decoded.userId, targetType: "session" });
    } catch { /* clear the browser cookie even for expired or malformed tokens */ }
  }
  const { maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie("token", clearOptions).json({ message: "Logged out." });
}

// POST /api/auth/change-password  { currentPassword, newPassword }
// Works for both roles. Changing the password bumps User.updatedAt, which
// (see middleware/auth.js) ends every OTHER session opened with the old
// password; this session gets a fresh cookie right here.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (!isString(currentPassword, { min: 1, max: 200 }) || !isString(newPassword, { min: 8, max: 128 })) {
    return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "كلمة المرور الحالية غير صحيحة." });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  const { token } = await issueSession(req, user.id, user.role);
  audit(req, "password_changed", { userId: user.id, targetType: "user", targetId: user.id });
  await notifyUser(user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: "تم تغيير كلمة المرور", body: "تم تغيير كلمة المرور وإغلاق الجلسات الأخرى.", link: user.role === "TEACHER" ? "/teacher/security" : "/student/security" });
  res.cookie("token", token, cookieOptions()).json({ message: "تم تغيير كلمة المرور.", token });
}

module.exports = { login, qrLogin, me, logout, changePassword, serializeUser };
