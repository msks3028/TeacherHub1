const express = require("express");
const { authenticate } = require("../middleware/auth");
const { streamVideo, serveMaterial } = require("../controllers/fileController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(authenticate); // every file route requires a valid session

router.get("/video/:videoId", asyncHandler(streamVideo));
router.get("/material/:materialId", asyncHandler(serveMaterial));

module.exports = router;
