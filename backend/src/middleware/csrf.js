const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function configuredOrigins() {
  const values = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((value) => value.trim()).filter(Boolean);
  return new Set(values.map((value) => {
    try { return new URL(value).origin; } catch { return ""; }
  }).filter(Boolean));
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin") || (() => {
    const referer = req.get("referer");
    try { return referer ? new URL(referer).origin : null; } catch { return null; }
  })();
  if (origin) {
    if (!configuredOrigins().has(origin)) return res.status(403).json({ message: "Request origin is not allowed." });
    return next();
  }
  // Cookie-authenticated browser requests must prove they originated in this
  // site. Bearer-only API clients do not send ambient credentials and remain
  // compatible with non-browser clients that omit Origin and Fetch Metadata.
  if (req.cookies?.token && req.get("sec-fetch-site") !== "same-origin") {
    return res.status(403).json({ message: "Request origin could not be verified." });
  }
  next();
}

module.exports = { csrfProtection, configuredOrigins };
