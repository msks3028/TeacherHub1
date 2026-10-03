const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { teacherSearch, studentSearch } = require("../controllers/searchController");

const teacherRouter = express.Router();
teacherRouter.use(authenticate, authorize("TEACHER"));
teacherRouter.get("/", asyncHandler(teacherSearch));

const studentRouter = express.Router();
studentRouter.use(authenticate, authorize("STUDENT"));
studentRouter.get("/", asyncHandler(studentSearch));

module.exports = { teacherRouter, studentRouter };
