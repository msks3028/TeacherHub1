const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const profileCtrl = require("../controllers/profileController");
const settingsCtrl = require("../controllers/settingsController");

const teacherRouter = express.Router();
teacherRouter.use(authenticate, authorize("TEACHER"));
teacherRouter.get("/profile", asyncHandler(profileCtrl.getTeacherProfile));
teacherRouter.put("/profile", asyncHandler(profileCtrl.updateTeacherProfile));
teacherRouter.put("/settings", asyncHandler(settingsCtrl.updateSettings));

const studentRouter = express.Router();
studentRouter.use(authenticate, authorize("STUDENT"));
studentRouter.get("/profile", asyncHandler(profileCtrl.getStudentProfile));
studentRouter.put("/profile", asyncHandler(profileCtrl.updateStudentProfile));

module.exports = { teacherRouter, studentRouter };
