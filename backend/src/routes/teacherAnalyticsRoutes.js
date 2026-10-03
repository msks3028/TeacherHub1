const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { getTeacherAnalytics } = require("../controllers/teacherAnalyticsController");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));
router.get("/", asyncHandler(getTeacherAnalytics));
module.exports = router;
