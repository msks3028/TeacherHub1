const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { getGeneralVideos, createGeneralVideo, deleteVideo } = require("../controllers/courseController");
const { getVideoAnalytics } = require("../controllers/videoAnalyticsController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate, authorize("TEACHER"));

// Only videos NOT attached to any course/lesson/homework — the general
// section explicitly excludes course content, per the isolation rule.
router.get("/general", asyncHandler(getGeneralVideos));
router.post("/", asyncHandler(createGeneralVideo));
router.delete("/:videoId", asyncHandler(deleteVideo));
router.get("/:videoId/analytics", asyncHandler(getVideoAnalytics));

module.exports = router;

// Analytics appended separately to keep the base file focused on general videos.
