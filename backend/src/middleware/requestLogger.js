const logger = require("../utils/logger");

// Lightweight request logger — one line per request, after it finishes, with
// the method/path/status/duration and the calling user when known. Kept
// deliberately simple (no external dependency like morgan) since we already
// have Winston and don't need much more than this for a single-teacher app.
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    // Query strings can contain search terms or bearer-like tokens. Log only
    // the route path so secrets and user-entered query data stay out of logs.
    const line = `${req.method} ${req.path} ${res.statusCode} ${ms}ms`;
    const meta = { userId: req.user?.id, role: req.user?.role };
    if (res.statusCode >= 500) logger.error(line, meta);
    else if (res.statusCode >= 400) logger.warn(line, meta);
    else logger.http ? logger.http(line, meta) : logger.info(line, meta);
  });
  next();
}

module.exports = requestLogger;
