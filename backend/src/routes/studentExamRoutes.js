const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/examController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));

router.get("/", asyncHandler(ctrl.getMyExams));
router.post("/:examId/start", asyncHandler(ctrl.startAttempt));
router.post("/attempts/:attemptId/answer", asyncHandler(ctrl.saveAnswer));
router.post("/attempts/:attemptId/submit", asyncHandler(ctrl.submitAttempt));

module.exports = router;
