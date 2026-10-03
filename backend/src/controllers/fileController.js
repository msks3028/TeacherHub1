const path = require("path");
const fs = require("fs");
const prisma = require("../config/db");
const { studentCanSee, getAccessibleVideo } = require("../services/accessService");
const logger = require("../utils/logger");
const storageService = require("../services/storageService");
const { teacherOwnsContent } = require("../services/contentOwnership");

const { UPLOAD_ROOT } = require("../config/paths");

const MISSING_FILE_MESSAGE =
  "ملف الفيديو غير موجود على السيرفر. غالبًا تم نقل مجلد المشروع بدون مجلد backend/uploads القديم — أعد رفع الفيديو أو انقل المجلد القديم.";

const VIDEO_MIME = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/mp4", // H.264 .mov plays in browsers when served as mp4
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
};

function resolveSafePath(relativeUrl) {
  // fileUrl values are stored as "/uploads/xxx/yyy.ext" — strip the prefix
  // and resolve against UPLOAD_ROOT, then verify the result never escapes
  // that directory (blocks path traversal like "../../etc/passwd").
  const cleaned = relativeUrl.replace(/^\/?uploads\//, "");
  const fullPath = path.resolve(UPLOAD_ROOT, cleaned);
  if (fullPath !== UPLOAD_ROOT && !fullPath.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return fullPath;
}

function keyFor(relativeUrl) {
  return relativeUrl.replace(/^\/?uploads\//, "");
}

// GET /api/files/video/:videoId  (streams with Range support, or redirects to
// a short-lived signed URL when the file lives in remote object storage)
async function streamVideo(req, res) {
  const { video, error } = await getAccessibleVideo(req.user, req.params.videoId);
  if (error) return res.status(error.status).json({ message: error.message });

  // Record the view once per playback start, not on every Range chunk the
  // browser requests while buffering/seeking (that was one DB write per chunk).
  const range = req.headers.range;
  const isStart = !range || /^bytes=0-/.test(range);
  if (req.user.role === "STUDENT" && isStart) {
    const student = req.user.studentProfile;
    await prisma.videoView.upsert({
      where: { videoId_studentId: { videoId: video.id, studentId: student.id } },
      update: { lastWatchedAt: new Date() },
      create: { videoId: video.id, studentId: student.id },
    });
  }

  if (storageService.isRemoteEnabled) {
    // The bucket serves Range requests itself, so we don't re-implement that
    // logic against a remote object — the browser talks to S3 directly for
    // the actual bytes, only the (already permission-checked) URL comes from us.
    const url = await storageService.getSignedGetUrl(keyFor(video.fileUrl));
    res.set("Cache-Control", "private, no-store");
    return res.redirect(302, url);
  }

  const filePath = resolveSafePath(video.fileUrl);
  if (!filePath || !fs.existsSync(filePath)) {
    // Log the exact path we looked for, so it's obvious in the server console
    // whether the file was never uploaded here or the uploads folder moved.
    logger.warn(`Video file missing on disk`, { videoId: video.id, filePath, fileUrl: video.fileUrl });
    return res.status(404).json({ message: MISSING_FILE_MESSAGE, code: "VIDEO_FILE_MISSING" });
  }

  res.set("Cache-Control", "private, no-store");
  streamFileWithRangeSupport(req, res, filePath);
}

// GET /api/files/material/:materialId?download=1
// Only these extensions are ever served, each with a fixed Content-Type, so an
// uploaded file can never be interpreted by the browser as HTML/JS (stored XSS).
const MATERIAL_MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function serveMaterial(req, res) {
  const material = await prisma.material.findUnique({ where: { id: req.params.materialId } });
  if (!material) return res.status(404).json({ message: "File not found." });

  if (req.user.role === "STUDENT") {
    const student = req.user.studentProfile;
    const allowed = await studentCanSee("material", student, material);
    if (!allowed) return res.status(403).json({ message: "You do not have access to this file." });

    if (req.query.download && !material.allowDownload) {
      return res.status(403).json({ message: "Downloading this file is not allowed." });
    }
  } else if (!(await teacherOwnsContent("material", material.id, req.user.id))) {
    return res.status(404).json({ message: "File not found." });
  }

  const ext = path.extname(material.fileUrl).toLowerCase();
  const contentType = MATERIAL_MIME[ext];
  if (!contentType) {
    return res.status(403).json({ message: "This file type cannot be served." });
  }

  const wantsDownload = req.query.download && (req.user.role === "TEACHER" || material.allowDownload);

  if (storageService.isRemoteEnabled) {
    const url = await storageService.getSignedGetUrl(keyFor(material.fileUrl), {
      downloadFilename: wantsDownload ? path.basename(material.fileUrl) : null,
    });
    return res.redirect(302, url);
  }

  const filePath = resolveSafePath(material.fileUrl);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File missing on server." });
  }

  res.set("Content-Type", contentType);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "private, no-store");

  if (wantsDownload) {
    return res.download(filePath, path.basename(filePath));
  }
  res.set("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
  res.sendFile(filePath);
}

function streamFileWithRangeSupport(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const contentType = VIDEO_MIME[path.extname(filePath).toLowerCase()] || "video/mp4";
  const range = req.headers.range;

  let start = 0;
  let end = stat.size - 1;
  let status = 200;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
      res.set("Content-Range", `bytes */${stat.size}`);
      return res.status(416).end();
    }
    if (match[1] === "") {
      // suffix range: "bytes=-500" => last 500 bytes
      const suffix = parseInt(match[2], 10);
      start = Math.max(stat.size - suffix, 0);
    } else {
      start = parseInt(match[1], 10);
      if (match[2] !== "") end = Math.min(parseInt(match[2], 10), stat.size - 1);
    }
    if (start >= stat.size || start > end) {
      res.set("Content-Range", `bytes */${stat.size}`);
      return res.status(416).end();
    }
    status = 206;
  }

  const headers = {
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": contentType,
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
  res.writeHead(status, headers);

  const stream = fs.createReadStream(filePath, { start, end });
  stream.on("error", (err) => {
    logger.error("Video stream error", { error: err.message });
    res.destroy(err);
  });
  // Stop reading from disk if the browser closes the connection (seeking, navigating away).
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

module.exports = { streamVideo, serveMaterial };
