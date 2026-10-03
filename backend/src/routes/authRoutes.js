const express = require("express");
const { login, qrLogin, me, logout, changePassword } = require("../controllers/authController");
const { loginLimiter } = require("../middleware/rateLimiters");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Brute-force protection (failed attempts only) lives in middleware/rateLimiters.js

router.post("/login", loginLimiter, asyncHandler(login));
router.post("/qr-login", loginLimiter, asyncHandler(qrLogin));
router.get("/me", authenticate, asyncHandler(me));
router.post("/logout", asyncHandler(logout));
router.post("/change-password", authenticate, loginLimiter, asyncHandler(changePassword));

module.exports = router;
