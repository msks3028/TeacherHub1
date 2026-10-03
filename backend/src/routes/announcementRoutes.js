const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/announcementController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));

router.get("/", asyncHandler(ctrl.listAnnouncements));
router.post("/", asyncHandler(ctrl.createAnnouncement));
router.delete("/:announcementId", asyncHandler(ctrl.deleteAnnouncement));

module.exports = router;
