const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/commentController");
const asyncHandler = require("../utils/asyncHandler");
const { commentLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// NOTE: this router is mounted at "/api", so authentication is applied per
// route (not with router.use) — otherwise EVERY /api request would pass
// through an extra session lookup here before reaching its real router.
router.get("/videos/:videoId/comments", authenticate, asyncHandler(ctrl.listComments));
router.post("/videos/:videoId/comments", authenticate, commentLimiter, asyncHandler(ctrl.addComment));
router.delete("/teacher/comments/:commentId", authenticate, authorize("TEACHER"), asyncHandler(ctrl.deleteComment));
router.patch("/teacher/comments/:commentId/hide", authenticate, authorize("TEACHER"), asyncHandler(ctrl.hideComment));

module.exports = router;
