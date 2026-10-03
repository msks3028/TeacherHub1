const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/studentController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Every route here is teacher-only, enforced server-side.
router.use(authenticate, authorize("TEACHER"));

router.get("/", asyncHandler(ctrl.listStudents));
router.post("/", asyncHandler(ctrl.createStudent));
router.get("/:studentId", asyncHandler(ctrl.getStudent));
router.put("/:studentId", asyncHandler(ctrl.updateStudent));
router.patch("/:studentId/status", asyncHandler(ctrl.setStudentActive));
router.delete("/:studentId", asyncHandler(ctrl.deleteStudent));
router.post("/:studentId/reset-password", asyncHandler(ctrl.resetPassword));
router.post("/:studentId/regenerate-qr", asyncHandler(ctrl.regenerateQr));

module.exports = router;
