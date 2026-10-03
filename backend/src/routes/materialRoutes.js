const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const ctrl = require("../controllers/materialController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("TEACHER"));

router.get("/", asyncHandler(ctrl.listMaterials));
router.post("/", asyncHandler(ctrl.createMaterial));
router.delete("/:materialId", asyncHandler(ctrl.deleteMaterial));

module.exports = router;
