const express = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/securityController");
const asyncHandler = require("../utils/asyncHandler");
const { securityActionLimiter } = require("../middleware/rateLimiters");

const router = express.Router();
router.use(authenticate);
router.get("/settings", asyncHandler(ctrl.getSecuritySettings));
router.get("/sessions", asyncHandler(ctrl.listSessions));
router.delete("/sessions/others", asyncHandler(ctrl.revokeOtherSessions));
router.delete("/sessions/:sessionId", asyncHandler(ctrl.revokeSession));
router.post("/two-factor/setup", securityActionLimiter, asyncHandler(ctrl.setupTwoFactor));
router.post("/two-factor/enable", securityActionLimiter, asyncHandler(ctrl.enableTwoFactor));
router.post("/two-factor/disable", securityActionLimiter, asyncHandler(ctrl.disableTwoFactor));

module.exports = router;
