const rateLimit = require("express-rate-limit");
const { verifyToken } = require("../utils/jwt");

// ---------------------------------------------------------------------------
// Who is "the caller" for rate limiting?
//
// Limiting purely by IP is wrong for a classroom: 30 students on the same
// school Wi-Fi share one IP and would exhaust the budget together. So once a
// caller has a VALID session we count per user; everyone else (anonymous
// traffic, or a forged/garbage token) is counted per IP. The token signature
// is verified, so an attacker can't dodge limits by sending random cookies.
// ---------------------------------------------------------------------------
function callerKey(req) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.userId) return `u:${decoded.userId}`;
    }
  } catch {
    /* invalid/expired token -> fall back to IP */
  }
  return `ip:${req.ip}`;
}

const tooMany = (message) => ({ message });

// Whole API (per user, or per IP when anonymous).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  keyGenerator: callerKey,
  skip: (req) => req.path.startsWith("/files/"), // video/PDF streaming has its own limiter
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("طلبات كثيرة جدًا. حاول بعد قليل."),
});

// Video/PDF streaming: browsers issue many Range requests per video.
const filesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  keyGenerator: callerKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("طلبات كثيرة جدًا. حاول بعد قليل."),
});

// Brute-force protection for login / QR login. Only FAILED attempts count, so
// a whole class scanning QR codes from one IP is never locked out, while a
// password-guessing attacker is stopped after 10 wrong tries per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("محاولات تسجيل دخول كثيرة. حاول مرة أخرى بعد 15 دقيقة."),
});

// Sensitive account actions share a smaller per-user budget so a valid but
// stolen session cannot brute-force TOTP confirmation.
const securityActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: callerKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("محاولات الأمان كثيرة جدًا. حاول بعد قليل."),
});

// The AI assistant costs real money per message.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: callerKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("أرسلت رسائل كثيرة للمساعد. انتظر بضع دقائق ثم حاول مرة أخرى."),
});

// Uploads fill the disk.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  keyGenerator: callerKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("عدد كبير من عمليات الرفع. حاول لاحقًا."),
});

// Comment spam.
const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  keyGenerator: callerKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("تعليقات كثيرة جدًا. انتظر قليلًا."),
});

module.exports = { apiLimiter, filesLimiter, loginLimiter, securityActionLimiter, aiLimiter, uploadLimiter, commentLimiter };
