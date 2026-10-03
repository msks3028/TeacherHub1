const webpush = require("web-push");
const prisma = require("../config/db");
const logger = require("../utils/logger");

let configured = false;
function isConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (!isConfigured()) return false;
  if (!configured) {
    const contact = process.env.VAPID_CONTACT || "mailto:admin@example.invalid";
    webpush.setVapidDetails(contact, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

function getPublicKey() {
  return configure() ? process.env.VAPID_PUBLIC_KEY : null;
}

async function sendToUsers(userIds, { title, body, url }) {
  if (!configure() || !Array.isArray(userIds) || !userIds.length) return;
  const uniqueIds = [...new Set(userIds)];
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: { in: uniqueIds } } });
  const path = typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";
  const payload = JSON.stringify({ title: String(title || "TeacherHub").slice(0, 100), body: String(body || "لديك إشعار جديد.").slice(0, 240), url: path });
  await Promise.allSettled(subscriptions.map(async (entry) => {
    try {
      await webpush.sendNotification({ endpoint: entry.endpoint, keys: { p256dh: entry.p256dh, auth: entry.auth } }, payload, { TTL: 3600 });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: entry.id } });
      } else {
        logger.warn("Web Push delivery failed", { statusCode: error.statusCode, subscriptionId: entry.id });
      }
    }
  }));
}

module.exports = { isConfigured, getPublicKey, sendToUsers };
