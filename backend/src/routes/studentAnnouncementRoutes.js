const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { getMyAnnouncements } = require("../controllers/announcementController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));
router.get("/", asyncHandler(getMyAnnouncements));

module.exports = router;
