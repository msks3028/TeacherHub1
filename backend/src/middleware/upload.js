const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const { UPLOAD_ROOT: ROOT } = require("../config/paths");
const logger = require("../utils/logger");
const storageService = require("../services/storageService");

// sharp is required lazily inside optimizeImageIfNeeded so a missing/failed
// native binary (rare, platform-specific) can never crash unrelated uploads
// (videos/PDFs/submissions never touch this code path at all).
let sharp = null;
function loadSharp() {
  if (sharp === null) {
    try {
      sharp = require("sharp");
    } catch (err) {
      logger.warn("sharp is not available — uploaded images will be stored unoptimized", { error: err.message });
      sharp = false;
    }
  }
  return sharp || null;
}

const DESTS = {
  video: "videos",
  pdf: "pdfs",
  image: "images",
  submission: "submissions",
};

const ALLOWED_MIME = {
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  pdf: ["application/pdf"],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  submission: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "video/mp4",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

// The stored extension comes from the MIME type we validated — NEVER from the
// client-supplied filename. Otherwise a file named "x.html" sent with a
// "application/pdf" header would be stored as .html and later be served to
// other users as a web page (stored XSS).
const EXT_BY_MIME = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogg",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const ISO_BMFF_ATOMS = ["ftyp", "moov", "mdat", "wide", "free", "skip", "styp", "junk", "pnot", "uuid", "pdin"];
function isIsoBmff(b) {
  return ISO_BMFF_ATOMS.includes(b.slice(4, 8).toString("latin1")) || b.slice(0, 64).includes("ftyp");
}

// The MIME type is only a header the client chose, so we also check the first
// bytes of the saved file (its "magic number") against what it claims to be.
const MAGIC = {
  "image/png": (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => ["GIF87a", "GIF89a"].includes(b.slice(0, 6).toString("latin1")),
  "image/webp": (b) => b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP",
  // MP4/MOV files start with an "atom" whose type sits at bytes 4-8 (usually
  // ftyp). Phones and editors also produce files that begin with other atoms
  // (styp, junk, pnot, uuid…), so we accept any of the known ones — or an
  // "ftyp" atom anywhere in the first bytes.
  "video/mp4": (b) => isIsoBmff(b),
  "video/quicktime": (b) => isIsoBmff(b),
  "video/webm": (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  "video/ogg": (b) => b.slice(0, 4).toString("latin1") === "OggS",
  "application/msword": (b) => b.slice(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) => b[0] === 0x50 && b[1] === 0x4b,
};

const HEAD_BYTES = 1024;

/**
 * Call after multer has saved req.file. Returns true if the file is acceptable.
 * If not, the file is deleted and false is returned.
 *
 * PDF headers may be preceded by a BOM/whitespace; accept the signature
 * anywhere in the first 1024 bytes, but never trust the client MIME type alone.
 */
function verifyUploadedFile(file) {
  try {
    const fd = fs.openSync(file.path, "r");
    const head = Buffer.alloc(HEAD_BYTES);
    const read = fs.readSync(fd, head, 0, HEAD_BYTES, 0);
    fs.closeSync(fd);
    if (read === 0) throw new Error("empty file");
    const bytes = head.subarray(0, read);

    if (file.mimetype === "application/pdf") {
      if (!bytes.includes("%PDF-")) throw new Error("missing PDF signature");
      return true;
    }

    const check = MAGIC[file.mimetype];
    if (check && read >= 12 && check(bytes)) return true;
  } catch {
    /* fall through to cleanup */
  }
  fs.unlink(file.path, () => {});
  return false;
}

function storageFor(kind) {
  const dir = path.join(ROOT, DESTS[kind]);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      cb(null, `${uuidv4()}${EXT_BY_MIME[file.mimetype] || ""}`);
    },
  });
}

const KIND_LABELS = { video: "فيديو", pdf: "PDF", image: "صورة", submission: "تسليم" };

// Some browsers / operating systems label a perfectly normal PDF as
// "application/x-pdf", "application/acrobat", or even "application/octet-stream"
// (Windows machines without a PDF reader registered). Judge those by the file
// name instead of refusing them.
function normalizePdfMime(file) {
  const name = (file.originalname || "").toLowerCase();
  const odd = ["application/x-pdf", "application/acrobat", "applications/vnd.pdf", "text/pdf", "text/x-pdf"];
  if (odd.includes(file.mimetype) || ((file.mimetype === "application/octet-stream" || !file.mimetype) && name.endsWith(".pdf"))) {
    file.mimetype = "application/pdf";
  }
}

function fileFilterFor(kind) {
  return (req, file, cb) => {
    normalizePdfMime(file);
    if (!ALLOWED_MIME[kind].includes(file.mimetype)) {
      const err = new Error(`Unsupported file type for ${kind}: ${file.mimetype}`);
      err.statusCode = 400;
      err.publicMessage = `نوع الملف غير مدعوم لخانة "${KIND_LABELS[kind] || kind}" (النوع المكتشف: ${file.mimetype}). تأكد إنك اخترت ملف ${KIND_LABELS[kind] || kind} حقيقي.`;
      return cb(err);
    }
    cb(null, true);
  };
}

function maxSizeFor(kind) {
  if (kind === "video") return Number(process.env.MAX_VIDEO_SIZE) || 500 * 1024 * 1024;
  return Number(process.env.MAX_FILE_SIZE) || 25 * 1024 * 1024;
}

// Returns a configured multer instance for a given content kind.
function uploaderFor(kind) {
  return multer({
    storage: storageFor(kind),
    fileFilter: fileFilterFor(kind),
    limits: { fileSize: maxSizeFor(kind) },
  });
}

// Converts a saved multer file into the public-relative URL stored in DB.
function toPublicUrl(kind, file) {
  return `/uploads/${DESTS[kind]}/${file.filename}`;
}

const INVALID_CONTENT_MESSAGE = "محتوى الملف لا يطابق نوعه المعلن. ارفع ملفًا حقيقيًا بصيغة صحيحة.";

// Max dimension (px) an uploaded image is resized down to. Course covers,
// video thumbnails, avatars, and the platform logo/favicon never need to be
// shown larger than this, so anything bigger (a raw phone-camera photo, e.g.
// 4000x3000) is downscaled — this is the single biggest lever for page load
// time on a slow connection, much more than format choice alone.
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 80;

// Re-encodes an uploaded image to WebP and downsizes it, in place. Skips
// GIFs entirely (an animated GIF re-encoded through sharp's default pipeline
// collapses to a single still frame, which would silently break animated
// content someone uploaded on purpose). Mutates `file` (path/filename/
// mimetype/size) so every caller downstream (toPublicUrl, DB save) picks up
// the new file automatically without knowing optimization happened.
async function optimizeImageIfNeeded(file) {
  if (!file || file.mimetype === "image/gif") return file;
  const lib = loadSharp();
  if (!lib) return file;

  const optimizedPath = file.path.replace(/\.[^.]+$/, "") + ".webp";
  try {
    await lib(file.path)
      .rotate() // respect EXIF orientation before resizing (phone photos)
      .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY })
      .toFile(optimizedPath);

    fs.unlinkSync(file.path);
    file.path = optimizedPath;
    file.filename = path.basename(optimizedPath);
    file.mimetype = "image/webp";
    file.size = fs.statSync(optimizedPath).size;
  } catch (err) {
    logger.warn("Image optimization failed — keeping the original file", { error: err.message, file: file.originalname });
  }
  return file;
}

// Call once multer has saved + verifyUploadedFile has accepted the file.
// Runs image optimization (images only), then — only when STORAGE_DRIVER=s3
// is configured — uploads the result to the bucket and removes the local
// copy so the local disk is never the system of record. Always returns the
// same "/uploads/<kind>/<filename>" shaped URL either way, so nothing else
// in the codebase (DB columns, frontend, other controllers) needs to know
// which backend actually stored the bytes.
async function finalizeUpload(kind, file) {
  if (kind === "image") await optimizeImageIfNeeded(file);

  const url = toPublicUrl(kind, file);

  if (storageService.isRemoteEnabled) {
    const key = url.replace(/^\/uploads\//, "");
    try {
      await storageService.uploadLocalFile(key, file.path, file.mimetype);
    } catch (err) {
      logger.error("Upload to remote storage failed", {
        error: err.message,
        key,
      });
      await fs.promises.unlink(file.path).catch((cleanupError) => {
        logger.warn("Could not remove failed remote upload from local storage", { key, error: cleanupError.message });
      });
      const uploadError = new Error("Remote file storage is temporarily unavailable.");
      uploadError.statusCode = 503;
      uploadError.publicMessage = "تعذّر حفظ الملف الآن. حاول مرة أخرى.";
      throw uploadError;
    }

    await fs.promises.unlink(file.path).catch((cleanupError) => {
      logger.warn("Remote file was saved but its local temporary copy could not be removed", { key, error: cleanupError.message });
    });
  }

  return url;
}

module.exports = { uploaderFor, toPublicUrl, verifyUploadedFile, finalizeUpload, INVALID_CONTENT_MESSAGE };
