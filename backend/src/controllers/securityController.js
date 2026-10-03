const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const prisma = require("../config/db");
const { isString } = require("../utils/validate");
const { generateSecret, verifyTotp, encryptSecret } = require("../utils/totp");
const { verifySecondFactor, hashRecoveryCode } = require("../services/securityService");
const { audit } = require("../services/auditService");
const { notifyUser } = require("../services/notificationService");

async function listSessions(req, res) {
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });
  res.set("Cache-Control", "no-store").json({ sessions: sessions.map((session) => ({ ...session, current: session.id === req.authSession?.id })) });
}

async function revokeSession(req, res) {
  if (req.params.sessionId === req.authSession?.id) {
    return res.status(400).json({ message: "استخدم تسجيل الخروج لإنهاء الجلسة الحالية." });
  }
  const result = await prisma.session.updateMany({
    where: { id: req.params.sessionId, userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) return res.status(404).json({ message: "الجلسة غير موجودة أو منتهية." });
  audit(req, "session_revoked", { targetType: "session", targetId: req.params.sessionId });
  await notifyUser(req.user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: "تم إنهاء جلسة", body: "تم إنهاء جلسة دخول من إعدادات الأمان.", link: req.user.role === "TEACHER" ? "/teacher/security" : "/student/security" });
  res.json({ message: "تم إنهاء الجلسة." });
}

async function revokeOtherSessions(req, res) {
  const result = await prisma.session.updateMany({
    where: { userId: req.user.id, revokedAt: null, id: { not: req.authSession?.id || "" } },
    data: { revokedAt: new Date() },
  });
  audit(req, "other_sessions_revoked", { targetType: "session", details: { count: result.count } });
  if (result.count) await notifyUser(req.user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: "تم تسجيل الخروج من الأجهزة الأخرى", body: `تم إنهاء ${result.count} جلسة أخرى.`, link: req.user.role === "TEACHER" ? "/teacher/security" : "/student/security" });
  res.json({ message: "تم تسجيل الخروج من الأجهزة الأخرى.", revokedCount: result.count });
}

async function getSecuritySettings(req, res) {
  res.set("Cache-Control", "no-store").json({
    twoFactorEnabled: !!req.user.twoFactorEnabled,
  });
}

async function setupTwoFactor(req, res) {
  const { password } = req.body || {};
  if (!isString(password, { min: 1, max: 200 })) return res.status(400).json({ message: "أدخل كلمة المرور الحالية للمتابعة." });
  if (req.user.twoFactorEnabled) return res.status(409).json({ message: "المصادقة الثنائية مفعّلة بالفعل." });
  const currentUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true, twoFactorEnabled: true } });
  if (!currentUser || currentUser.twoFactorEnabled) return res.status(409).json({ message: "المصادقة الثنائية مفعّلة بالفعل." });
  if (!(await bcrypt.compare(password, currentUser.passwordHash))) return res.status(401).json({ message: "كلمة المرور الحالية غير صحيحة." });
  const secret = generateSecret();
  const label = encodeURIComponent(`TeacherHub:${req.user.email}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=TeacherHub&algorithm=SHA1&digits=6&period=30`;
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
  res.set("Cache-Control", "no-store").json({ secret, otpauthUrl, qrDataUrl });
}

async function enableTwoFactor(req, res) {
  const { secret, code, password } = req.body || {};
  if (!isString(secret, { min: 16, max: 64 }) || !/^\d{6}$/.test(String(code || "")) || !isString(password, { min: 1, max: 200 })) {
    return res.status(400).json({ message: "أدخل كلمة المرور الحالية والسر ورمز التحقق المكوّن من 6 أرقام." });
  }
  const currentUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true, twoFactorEnabled: true } });
  if (!currentUser || currentUser.twoFactorEnabled) return res.status(409).json({ message: "المصادقة الثنائية مفعّلة بالفعل." });
  if (!(await bcrypt.compare(password, currentUser.passwordHash))) return res.status(401).json({ message: "كلمة المرور الحالية غير صحيحة." });
  if (!verifyTotp(secret, code)) return res.status(400).json({ message: "الرمز غير صحيح أو انتهت صلاحيته." });

  const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(8).toString("hex").toUpperCase());
  const enabled = await prisma.user.updateMany({
    where: { id: req.user.id, twoFactorEnabled: false },
    data: {
      twoFactorEnabled: true,
      twoFactorSecretCiphertext: encryptSecret(secret),
      twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
    },
  });
  if (!enabled.count) return res.status(409).json({ message: "تغيّرت إعدادات المصادقة الثنائية. حدّث الصفحة وحاول مرة أخرى." });
  await prisma.session.updateMany({ where: { userId: req.user.id, revokedAt: null, id: { not: req.authSession?.id || "" } }, data: { revokedAt: new Date() } });
  audit(req, "two_factor_enabled", { targetType: "user", targetId: req.user.id });
  await notifyUser(req.user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: "تم تفعيل المصادقة الثنائية", body: "أُضيفت طبقة تحقق إضافية إلى حسابك.", link: req.user.role === "TEACHER" ? "/teacher/security" : "/student/security" });
  res.set("Cache-Control", "no-store").json({ message: "تم تفعيل المصادقة الثنائية.", recoveryCodes });
}

async function disableTwoFactor(req, res) {
  const { password, code } = req.body || {};
  if (!isString(password, { min: 1, max: 200 }) || !isString(code, { min: 6, max: 100 })) {
    return res.status(400).json({ message: "كلمة المرور ورمز المصادقة مطلوبان." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.twoFactorEnabled) return res.status(409).json({ message: "المصادقة الثنائية غير مفعّلة." });
  if (!(await bcrypt.compare(password, user.passwordHash)) || !(await verifySecondFactor(user, code))) {
    return res.status(401).json({ message: "كلمة المرور أو رمز المصادقة غير صحيح." });
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecretCiphertext: null, twoFactorRecoveryCodes: null } });
  await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, id: { not: req.authSession?.id || "" } }, data: { revokedAt: new Date() } });
  audit(req, "two_factor_disabled", { targetType: "user", targetId: user.id });
  await notifyUser(user.id, { type: "ANNOUNCEMENT", category: "SECURITY", title: "تم إيقاف المصادقة الثنائية", body: "تم إيقاف المصادقة الثنائية على حسابك.", link: user.role === "TEACHER" ? "/teacher/security" : "/student/security" });
  res.json({ message: "تم إيقاف المصادقة الثنائية." });
}

module.exports = { listSessions, revokeSession, revokeOtherSessions, getSecuritySettings, setupTwoFactor, enableTwoFactor, disableTwoFactor };
