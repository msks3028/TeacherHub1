const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimiters");
const asyncHandler = require("../utils/asyncHandler");
const { generateTeacherDraft } = require("../controllers/teacherAiController");

const router = express.Router();
// Teacher AI is disabled by product policy. Keep the controller and endpoint
// wiring available for future use, but deny every role until it is re-enabled.
router.use(authenticate, authorize());
router.post("/draft", aiLimiter, asyncHandler(generateTeacherDraft));
module.exports = router;
