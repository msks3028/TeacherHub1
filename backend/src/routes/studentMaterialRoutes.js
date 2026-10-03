const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { getMyMaterials } = require("../controllers/materialController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("STUDENT"));
router.get("/", asyncHandler(getMyMaterials));

module.exports = router;
