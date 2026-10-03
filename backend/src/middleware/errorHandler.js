const logger = require("../utils/logger");

function notFound(req, res, next) {
  res.status(404).json({ message: "Route not found." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.message || "Unhandled error", {
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  if (err.code === "P2002") {
    // Prisma unique constraint violation
    return res.status(409).json({ message: "A record with these details already exists." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ message: "Requested record was not found." });
  }
  const dbErrorCode = err.code || err.errorCode;
  if (["P1000", "P1001", "P1002", "P1008", "P1017", "P2024"].includes(dbErrorCode) || err.name === "PrismaClientInitializationError") {
    return res.status(503).json({ message: "الخدمة غير متاحة مؤقتًا. حاول مرة أخرى." });
  }
  if (err.name === "MulterError") {
    const sizeMessage = err.code === "LIMIT_FILE_SIZE" ? "حجم الملف أكبر من الحد المسموح به." : "تعذّر إكمال رفع الملف.";
    return res.status(400).json({ message: sizeMessage });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.publicMessage || "Something went wrong. Please try again.",
  });
}

module.exports = { notFound, errorHandler };
