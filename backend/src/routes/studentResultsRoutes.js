const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { getMyResults } = require("../controllers/examController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));
router.get("/", asyncHandler(getMyResults));

module.exports = router;
