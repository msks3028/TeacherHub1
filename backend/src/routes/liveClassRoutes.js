const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/liveClassController");
const asyncHandler = require("../utils/asyncHandler");

const teacherRouter = express.Router();
teacherRouter.use(authenticate, authorize("TEACHER"));
teacherRouter.get("/", asyncHandler(ctrl.listTeacherLiveClasses));
teacherRouter.post("/", asyncHandler(ctrl.createLiveClass));
teacherRouter.post("/:liveClassId/start", asyncHandler(ctrl.startLiveClass));
teacherRouter.post("/:liveClassId/end", asyncHandler(ctrl.endLiveClass));
teacherRouter.post("/:liveClassId/join", asyncHandler(ctrl.teacherJoinLiveClass));
teacherRouter.get("/:liveClassId/participants", asyncHandler(ctrl.listParticipants));
teacherRouter.post("/:liveClassId/participants/:identity/:action", asyncHandler(ctrl.moderateParticipant));
teacherRouter.put("/:liveClassId", asyncHandler(ctrl.updateLiveClass));
teacherRouter.patch("/:liveClassId/cancel", asyncHandler(ctrl.cancelLiveClass));

const studentRouter = express.Router();
studentRouter.use(authenticate, authorize("STUDENT"));
studentRouter.get("/", asyncHandler(ctrl.listStudentLiveClasses));
studentRouter.post("/:liveClassId/join", asyncHandler(ctrl.studentJoinLiveClass));

module.exports = { teacherRouter, studentRouter };
