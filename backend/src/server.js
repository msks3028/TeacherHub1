require("dotenv").config();
require("./config/env").checkEnv(); // refuse to start with a missing/weak JWT_SECRET etc.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");
const { authenticate, authorize } = require("./middleware/auth");
const { apiLimiter, filesLimiter } = require("./middleware/rateLimiters");

const { notFound, errorHandler } = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const { UPLOAD_ROOT } = require("./config/paths");
const logger = require("./utils/logger");
const storageService = require("./services/storageService");
const { csrfProtection, configuredOrigins } = require("./middleware/csrf");
const asyncHandler = require("./utils/asyncHandler");
const { receiveWebhook: receiveLiveKitWebhook } = require("./controllers/liveKitWebhookController");
const { startNotificationReminderScheduler } = require("./services/notificationReminderService");
const prisma = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const courseRoutes = require("./routes/courseRoutes");
const videoRoutes = require("./routes/videoRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const studentLessonRoutes = require("./routes/studentLessonRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const studentHomeworkRoutes = require("./routes/studentHomeworkRoutes");
const materialRoutes = require("./routes/materialRoutes");
const studentMaterialRoutes = require("./routes/studentMaterialRoutes");
const examRoutes = require("./routes/examRoutes");
const studentExamRoutes = require("./routes/studentExamRoutes");
const studentResultsRoutes = require("./routes/studentResultsRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const studentAnnouncementRoutes = require("./routes/studentAnnouncementRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const commentRoutes = require("./routes/commentRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const studentUploadRoutes = require("./routes/studentUploadRoutes");
const aiRoutes = require("./routes/aiRoutes");
const { teacherRouter: teacherProfileRouter, studentRouter: studentProfileRouter } = require("./routes/profileRoutes");
const { getSettings } = require("./controllers/settingsController");
const { teacherRouter: teacherSearchRouter, studentRouter: studentSearchRouter } = require("./routes/searchRoutes");
const { teacherRouter: teacherDashboardRouter, studentRouter: studentDashboardRouter } = require("./routes/dashboardRoutes");
const studentContentRoutes = require("./routes/studentContentRoutes");
const filesRoutes = require("./routes/filesRoutes");
const securityRoutes = require("./routes/securityRoutes");
const { teacherRouter: teacherLiveClassRouter, studentRouter: studentLiveClassRouter } = require("./routes/liveClassRoutes");
const teacherAiRoutes = require("./routes/teacherAiRoutes");
const teacherAnalyticsRoutes = require("./routes/teacherAnalyticsRoutes");

const app = express();

// If the API runs behind a reverse proxy (nginx, Render, Railway, Cloudflare…)
// set TRUST_PROXY=1 in .env so rate limiting sees each visitor's real IP
// instead of the proxy's. Leave it unset when there is no proxy — trusting
// X-Forwarded-For without one would let anyone fake their IP.
if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isInteger(n) ? n : process.env.TRUST_PROXY);
}

// Parse query strings into plain strings only. The default parser turns
// "?grade[contains]=x" into an object, which would be passed on to Prisma as
// a filter (query-operator injection).
app.set("query parser", "simple");

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || configuredOrigins().has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
// LiveKit verifies its signed webhook against the exact raw payload bytes.
// Mount before express.json and CSRF middleware; requests are authenticated by
// the provider signature and have an explicit 1 MiB body limit.
app.post("/api/livekit/webhook", express.raw({ type: "application/webhook+json", limit: "1mb" }), asyncHandler(receiveLiveKitWebhook));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(requestLogger);
app.use("/api", csrfProtection);

// A student's QR image ENCODES their login token — scanning it logs in as that
// student. It is therefore a credential, not a harmless picture: only a
// signed-in teacher may fetch it, and it is never cached (regenerating a QR
// re-uses the same file name, so a cached copy would show a dead code).
app.use(
  "/uploads/qrcodes",
  authenticate,
  authorize("TEACHER"),
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  express.static(path.join(UPLOAD_ROOT, "qrcodes"), { index: false, dotfiles: "deny" })
);

// Uploaded IMAGES (course covers, video thumbnails, avatars, the platform
// logo) are served as plain static files. They are not private content — and
// the logo has to show on the login page, before anyone is signed in. Only the
// images folder is exposed (videos, PDFs and submissions stay behind
// /api/files and the permission checks). Files are named with a random UUID and
// their extension comes from the validated MIME type (png/jpg/webp/gif only,
// never SVG/HTML), and "nosniff" stops a browser from guessing another type.
app.use(
  "/uploads/images",
  (req, res, next) => {
    // Images are always uploaded through finalizeUpload(), which — when
    // STORAGE_DRIVER=s3 is set — pushes them to the bucket and deletes the
    // local copy. In that mode there is nothing left on disk to serve, so we
    // redirect to the bucket's public URL instead of 404ing.
    if (!storageService.isRemoteEnabled) return next();
    const key = `images${req.path}`; // req.path already starts with "/"
    return res.redirect(301, storageService.getPublicUrl(key));
  },
  express.static(path.join(UPLOAD_ROOT, "images"), {
    index: false,
    dotfiles: "deny",
    maxAge: "1d",
    setHeaders: (res) => {
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Per-user (or per-IP when anonymous) request budget — see middleware/rateLimiters.js
app.use("/api", apiLimiter);

// --- Public / shared ---
app.use("/api/auth", authRoutes);
app.get("/api/settings", getSettings); // needed to render login-page branding
app.get("/api/health", asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
}));
app.use("/api/notifications", notificationRoutes); // authenticate() applied inside, works for both roles
app.use("/api/security", securityRoutes);
app.use("/api", commentRoutes); // /api/videos/:id/comments (both roles) + /api/teacher/comments/* (teacher only)

// --- Protected file streaming (never a public static folder) ---
app.use("/api/files", filesLimiter, filesRoutes);

// --- Teacher-only ---
app.use("/api/teacher/dashboard", teacherDashboardRouter);
app.use("/api/teacher/live-classes", teacherLiveClassRouter);
app.use("/api/teacher/ai", teacherAiRoutes);
app.use("/api/teacher/analytics", teacherAnalyticsRoutes);
app.use("/api/teacher/students", studentRoutes);
app.use("/api/teacher/courses", courseRoutes);
app.use("/api/teacher/videos", videoRoutes);
app.use("/api/teacher/lessons", lessonRoutes);
app.use("/api/teacher/homework", homeworkRoutes);
app.use("/api/teacher/materials", materialRoutes);
app.use("/api/teacher/exams", examRoutes);
app.use("/api/teacher/announcements", announcementRoutes);
app.use("/api/teacher/upload", uploadRoutes);
app.use("/api/teacher/search", teacherSearchRouter);
app.use("/api/teacher", teacherProfileRouter); // /profile, /settings

// --- Student-only ---
app.use("/api/student/dashboard", studentDashboardRouter);
app.use("/api/student/live-classes", studentLiveClassRouter);
app.use("/api/student", studentContentRoutes); // /courses, /courses/:id, /videos
app.use("/api/student/lessons", studentLessonRoutes);
app.use("/api/student/homework", studentHomeworkRoutes);
app.use("/api/student/materials", studentMaterialRoutes);
app.use("/api/student/exams", studentExamRoutes);
app.use("/api/student/results", studentResultsRoutes);
app.use("/api/student/announcements", studentAnnouncementRoutes);
app.use("/api/student/search", studentSearchRouter);
app.use("/api/student/ai", aiRoutes);
app.use("/api/student", studentProfileRouter); // /profile
app.use("/api/student/upload", studentUploadRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`TeacherHub API running on port ${PORT}`);
});
const stopNotificationReminders = startNotificationReminderScheduler();
server.on("close", stopNotificationReminders);
// Node cuts any request that takes longer than 5 minutes by default, which
// would kill large video/file uploads midway. 0 = no limit.
server.requestTimeout = 0;

let shuttingDown = false;
function shutdown(reason, exitCode = 1) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopNotificationReminders();
  logger.error("Process-level failure; shutting down for supervisor restart", {
    error: reason?.stack || String(reason || "shutdown requested"),
  });

  const forceExit = setTimeout(() => process.exit(exitCode), 10_000);
  forceExit.unref();
  server.close(() => {
    prisma.$disconnect()
      .catch((err) => logger.error("Database disconnect failed during shutdown", { error: err.message }))
      .finally(() => {
        clearTimeout(forceExit);
        process.exit(exitCode);
      });
  });
}

process.on("uncaughtException", (error) => shutdown(error, 1));
process.on("unhandledRejection", (reason) => shutdown(reason, 1));
process.on("SIGTERM", () => shutdown(new Error("SIGTERM received"), 0));
process.on("SIGINT", () => shutdown(new Error("SIGINT received"), 0));
