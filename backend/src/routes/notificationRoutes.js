const express = require("express");
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/notificationController");
const asyncHandler = require("../utils/asyncHandler");
const pushController = require("../controllers/pushController");

const router = express.Router();
router.use(authenticate); // available to both roles, always scoped to req.user.id

router.get("/", asyncHandler(ctrl.listMyNotifications));
router.get("/preferences", asyncHandler(ctrl.getPreferences));
router.put("/preferences", asyncHandler(ctrl.updatePreferences));
router.get("/push/public-key", asyncHandler(pushController.getPublicKey));
router.post("/push/subscriptions", asyncHandler(pushController.saveSubscription));
router.delete("/push/subscriptions", asyncHandler(pushController.removeSubscription));
router.patch("/:notificationId/read", asyncHandler(ctrl.markRead));
router.patch("/:notificationId/unread", asyncHandler(ctrl.markUnread));
router.patch("/read-all", asyncHandler(ctrl.markAllRead));

module.exports = router;
