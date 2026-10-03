const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/dashboardController");

const teacherRouter = express.Router();
teacherRouter.use(authenticate, authorize("TEACHER"));
teacherRouter.get("/", asyncHandler(ctrl.getTeacherDashboard));

const studentRouter = express.Router();
studentRouter.use(authenticate, authorize("STUDENT"));
studentRouter.get("/", asyncHandler(ctrl.getStudentDashboard));

module.exports = { teacherRouter, studentRouter };
