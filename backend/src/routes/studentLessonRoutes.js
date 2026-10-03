const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/lessonController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));

router.get("/", asyncHandler(ctrl.getMyLessons));
router.get("/:lessonId", asyncHandler(ctrl.getMyLessonDetail));
router.patch("/:lessonId/progress", asyncHandler(ctrl.updateMyLessonProgress));

module.exports = router;
