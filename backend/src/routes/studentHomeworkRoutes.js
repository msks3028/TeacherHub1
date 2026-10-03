const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/homeworkController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));

router.get("/", asyncHandler(ctrl.getMyHomework));
router.post("/:homeworkId/submit", asyncHandler(ctrl.submitHomework));

module.exports = router;
