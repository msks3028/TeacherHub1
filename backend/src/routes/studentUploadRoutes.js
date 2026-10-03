const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { uploaderFor, finalizeUpload, verifyUploadedFile, INVALID_CONTENT_MESSAGE } = require("../middleware/upload");
const { uploadLimiter } = require("../middleware/rateLimiters");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));

// POST /api/student/upload/submission — homework attachments.
router.post("/submission", uploadLimiter, (req, res, next) => {
  const upload = uploaderFor("submission").single("file");
  upload(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    if (!verifyUploadedFile(req.file)) return res.status(400).json({ message: INVALID_CONTENT_MESSAGE });
    try {
      const url = await finalizeUpload("submission", req.file);
      res.status(201).json({ url, originalName: req.file.originalname });
    } catch (e) {
      next(e);
    }
  });
});

// POST /api/student/upload/avatar — the student's own profile picture.
router.post("/avatar", uploadLimiter, (req, res, next) => {
  const upload = uploaderFor("image").single("file");
  upload(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    if (!verifyUploadedFile(req.file)) return res.status(400).json({ message: INVALID_CONTENT_MESSAGE });
    try {
      const url = await finalizeUpload("image", req.file);
      res.status(201).json({ url, originalName: req.file.originalname });
    } catch (e) {
      next(e);
    }
  });
});

module.exports = router;
