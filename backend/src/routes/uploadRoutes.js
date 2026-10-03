const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { uploaderFor, finalizeUpload, verifyUploadedFile, INVALID_CONTENT_MESSAGE } = require("../middleware/upload");
const { uploadLimiter } = require("../middleware/rateLimiters");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));

// Generic upload endpoint: POST /api/teacher/upload/:kind  (kind = video|pdf|image)
// Returns the stored file's public URL so the caller can attach it to a
// Video/Material/etc record. Kept separate from content-creation endpoints
// so the frontend can show upload progress before submitting the form.
router.post("/:kind", uploadLimiter, (req, res, next) => {
  const { kind } = req.params;
  if (!["video", "pdf", "image"].includes(kind)) {
    return res.status(400).json({ message: "Invalid upload kind." });
  }
  const upload = uploaderFor(kind).single("file");
  upload(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    if (!verifyUploadedFile(req.file)) return res.status(400).json({ message: INVALID_CONTENT_MESSAGE });
    try {
      const url = await finalizeUpload(kind, req.file);
      res.status(201).json({ url, originalName: req.file.originalname });
    } catch (e) {
      next(e);
    }
  });
});

module.exports = router;
