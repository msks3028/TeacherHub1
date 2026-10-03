const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/courseController");
const asyncHandler = require("../utils/asyncHandler");
const units = require("../controllers/unitController");

const router = express.Router();

router.use(authenticate, authorize("TEACHER"));

router.get("/", asyncHandler(ctrl.listCourses));
router.post("/", asyncHandler(ctrl.createCourse));
router.post("/:courseId/units", asyncHandler(units.createUnit));
router.patch("/:courseId/units/reorder", asyncHandler(units.reorderUnits));
router.patch("/:courseId/units/:unitId/lessons/reorder", asyncHandler(units.reorderLessons));
router.put("/:courseId/units/:unitId", asyncHandler(units.updateUnit));
router.delete("/:courseId/units/:unitId", asyncHandler(units.deleteUnit));
router.get("/:courseId", asyncHandler(ctrl.getCourseDetail));
router.post("/:courseId/videos", asyncHandler(ctrl.addVideoToCourse));
router.post("/:courseId/enrollments", asyncHandler(ctrl.enrollStudents));
router.delete("/:courseId/enrollments/:studentId", asyncHandler(ctrl.unenrollStudent));

module.exports = router;
