const prisma = require("../config/db");
const { CATEGORIES } = require("../services/notificationService");

async function listMyNotifications(req, res) {
  const limitRaw = req.query.limit;
  const limit = limitRaw === undefined ? 20 : Number(limitRaw);
  const cursor = req.query.cursor;
  const since = req.query.since;
  const sinceDate = since === undefined ? null : new Date(since);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor !== undefined && (typeof cursor !== "string" || cursor.length > 64)) || (since !== undefined && (typeof since !== "string" || Number.isNaN(sinceDate.getTime())))) {
    return res.status(400).json({ message: "معاملات تقسيم الإشعارات غير صالحة." });
  }
  if (cursor && !await prisma.notification.findFirst({ where: { id: cursor, userId: req.user.id, inAppVisible: true }, select: { id: true } })) {
    return res.status(400).json({ message: "مؤشر صفحة الإشعارات غير صالح." });
  }
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id, inAppVisible: true, ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false, inAppVisible: true } }),
  ]);
  const hasMore = rows.length > limit;
  const notifications = hasMore ? rows.slice(0, limit) : rows;
  res.set("Cache-Control", "no-store").json({ notifications, unreadCount, nextCursor: hasMore ? notifications.at(-1).id : null });
}

async function markRead(req, res) {
  const result = await prisma.notification.updateMany({ where: { id: req.params.notificationId, userId: req.user.id }, data: { isRead: true } });
  if (!result.count) return res.status(404).json({ message: "Notification not found." });
  res.json({ message: "Marked as read." });
}

async function markUnread(req, res) {
  const result = await prisma.notification.updateMany({ where: { id: req.params.notificationId, userId: req.user.id, inAppVisible: true }, data: { isRead: false } });
  if (!result.count) return res.status(404).json({ message: "Notification not found." });
  res.json({ message: "Marked as unread." });
}

async function markAllRead(req, res) {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ message: "All marked as read." });
}

async function getPreferences(req, res) {
  const stored = await prisma.notificationPreference.findMany({ where: { userId: req.user.id } });
  const byCategory = new Map(stored.map((row) => [row.category, row]));
  const preferences = CATEGORIES.map((category) => {
    const row = byCategory.get(category);
    const security = category === "SECURITY";
    return { category, inAppEnabled: security ? true : row?.inAppEnabled !== false, pushEnabled: security ? true : row?.pushEnabled !== false };
  });
  res.set("Cache-Control", "no-store").json({ preferences });
}

async function updatePreferences(req, res) {
  const values = req.body?.preferences;
  if (!values || typeof values !== "object" || Array.isArray(values)) return res.status(400).json({ message: "إعدادات الإشعارات غير صالحة." });
  for (const [category, preference] of Object.entries(values)) {
    if (!CATEGORIES.includes(category) || !preference || typeof preference !== "object" || typeof preference.inAppEnabled !== "boolean" || typeof preference.pushEnabled !== "boolean") {
      return res.status(400).json({ message: "إعدادات الإشعارات غير صالحة." });
    }
    if (category === "SECURITY" && (!preference.inAppEnabled || !preference.pushEnabled)) return res.status(400).json({ message: "إشعارات الأمان إلزامية ولا يمكن إيقافها." });
  }
  const entries = Object.entries(values);
  if (entries.length) await prisma.$transaction(entries.map(([category, preference]) => prisma.notificationPreference.upsert({
    where: { userId_category: { userId: req.user.id, category } },
    create: { userId: req.user.id, category, ...preference },
    update: preference,
  })));
  return getPreferences(req, res);
}

module.exports = { listMyNotifications, markRead, markUnread, markAllRead, getPreferences, updatePreferences };
