// Small input-validation helpers shared by controllers. Every value that
// comes from req.body / req.query / req.params is untrusted: it may be a
// string, but it may also be an object, an array, a number or missing. These
// helpers make that explicit so a malformed request becomes a clean 400
// instead of a 500 (or, worse, a Prisma filter object smuggled into a query).

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function isString(v, { min = 0, max = Infinity } = {}) {
  return typeof v === "string" && v.length >= min && v.length <= max;
}

// Returns a trimmed string, or `fallback` when the value isn't a string.
function str(v, max = 500, fallback = "") {
  return typeof v === "string" ? v.trim().slice(0, max) : fallback;
}

function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

function isEmail(v) {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Only plain http(s) links — blocks javascript:, data:, file: and friends.
function isSafeHttpUrl(v, max = 500) {
  if (typeof v !== "string" || v.length > max) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isHexColor(v) {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

// Parses a date-like value. Returns a Date, null (for empty) or undefined (invalid).
function parseDate(v) {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

// Paths produced by our own upload middleware:  /uploads/<folder>/<uuid>.<ext>
const UPLOAD_URL_PATTERNS = {
  video: /^\/uploads\/videos\/[0-9a-fA-F-]{36}\.(mp4|webm|ogg|ogv|mov|m4v)$/i,
  pdf: /^\/uploads\/pdfs\/[0-9a-fA-F-]{36}\.pdf$/i,
  image: /^\/uploads\/images\/[0-9a-fA-F-]{36}\.(png|jpe?g|webp|gif)$/i,
  submission: /^\/uploads\/submissions\/[0-9a-fA-F-]{36}\.(pdf|png|jpe?g|mp4|doc|docx)$/i,
};

function isUploadUrl(kind, v) {
  return typeof v === "string" && v.length < 200 && UPLOAD_URL_PATTERNS[kind].test(v);
}

module.exports = {
  isString, str, isUuid, isEmail, isSafeHttpUrl, isHexColor,
  parseDate, isFiniteNumber, isUploadUrl,
};
