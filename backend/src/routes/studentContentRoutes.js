const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/studentContentController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate, authorize("STUDENT"));

router.get("/courses", asyncHandler(ctrl.getMyCourses));
router.get("/courses/:courseId", asyncHandler(ctrl.getMyCourseDetail));
router.get("/videos", asyncHandler(ctrl.getMyVideos));

module.exports = router;
