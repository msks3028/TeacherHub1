const prisma = require("../config/db");
const push = require("../services/webPushService");
const { isString } = require("../utils/validate");

function decodeBase64Url(value) {
  try { return Buffer.from(value, "base64url"); } catch { return Buffer.alloc(0); }
}

async function getPublicKey(req, res) {
  const vapidPublicKey = push.getPublicKey();
  if (!vapidPublicKey) return res.status(503).json({ message: "Web Push is not configured on this server." });
  res.set("Cache-Control", "no-store").json({ vapidPublicKey });
}

async function saveSubscription(req, res) {
  const subscription = req.body?.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  let parsed;
  try { parsed = new URL(endpoint); } catch { return res.status(400).json({ message: "Invalid push subscription." }); }
  if (!isString(endpoint, { min: 20, max: 2048 }) || parsed.protocol !== "https:" || !isString(p256dh, { min: 20, max: 256 }) || !isString(auth, { min: 8, max: 128 }) || decodeBase64Url(p256dh).length < 32 || decodeBase64Url(auth).length < 8) {
    return res.status(400).json({ message: "Invalid push subscription." });
  }
  if (!push.isConfigured()) return res.status(503).json({ message: "Web Push is not configured on this server." });
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (existing && existing.userId !== req.user.id) return res.status(409).json({ message: "Subscription is already registered." });
  const expirationTime = Number.isFinite(subscription.expirationTime) ? new Date(subscription.expirationTime) : null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.user.id, endpoint, p256dh, auth, expirationTime },
    update: { p256dh, auth, expirationTime },
  });
  res.status(201).json({ message: "تم تفعيل الإشعارات على هذا الجهاز." });
}

async function removeSubscription(req, res) {
  const endpoint = req.body?.endpoint;
  if (!isString(endpoint, { min: 20, max: 2048 })) return res.status(400).json({ message: "Invalid push endpoint." });
  const result = await prisma.pushSubscription.deleteMany({ where: { userId: req.user.id, endpoint } });
  res.json({ removed: result.count > 0 });
}

module.exports = { getPublicKey, saveSubscription, removeSubscription };
