const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/homeworkController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));

router.get("/", asyncHandler(ctrl.listHomework));
router.post("/", asyncHandler(ctrl.createHomework));
router.post("/:homeworkId/video", asyncHandler(ctrl.addVideoToHomework));
router.get("/:homeworkId", asyncHandler(ctrl.getHomeworkDetail));
router.put("/:homeworkId", asyncHandler(ctrl.updateHomework));
router.delete("/:homeworkId", asyncHandler(ctrl.deleteHomework));
router.patch("/submissions/:submissionId/grade", asyncHandler(ctrl.gradeSubmission));

module.exports = router;
