const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/lessonController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));

router.get("/", asyncHandler(ctrl.listLessons));
router.post("/", asyncHandler(ctrl.createLesson));
router.post("/:lessonId/duplicate", asyncHandler(ctrl.duplicateLesson));
router.get("/:lessonId", asyncHandler(ctrl.getLesson));
router.put("/:lessonId", asyncHandler(ctrl.updateLesson));
router.delete("/:lessonId", asyncHandler(ctrl.deleteLesson));

module.exports = router;
