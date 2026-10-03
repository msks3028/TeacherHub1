const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/aiController");
const asyncHandler = require("../utils/asyncHandler");
const { aiLimiter } = require("../middleware/rateLimiters");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));

router.get("/conversations", asyncHandler(ctrl.listConversations));
router.post("/message", aiLimiter, asyncHandler(ctrl.sendMessage));

module.exports = router;
