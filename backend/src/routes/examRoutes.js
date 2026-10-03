const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/examController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));

router.get("/essays-to-grade", asyncHandler(ctrl.listEssaysToGrade));
router.patch("/answers/:answerId/grade", asyncHandler(ctrl.gradeEssayAnswer));
router.get("/attempts/:attemptId", asyncHandler(ctrl.getAttemptDetail));
router.patch("/attempts/:attemptId/grade", asyncHandler(ctrl.gradeAttempt));
router.get("/", asyncHandler(ctrl.listExams));
router.post("/", asyncHandler(ctrl.createExam));
router.get("/:examId", asyncHandler(ctrl.getExamDetail));
router.get("/:examId/analytics", asyncHandler(ctrl.getExamAnalytics));

module.exports = router;
