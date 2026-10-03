const prisma = require("../config/db");
const { sendToUsers } = require("./webPushService");

const CATEGORIES = ["HOMEWORK", "EXAMS", "MATERIALS", "VIDEOS", "ANNOUNCEMENTS", "LIVE_CLASSES", "SECURITY"];
const TYPE_CATEGORY = {
  VIDEO_ADDED: "VIDEOS",
  HOMEWORK_ADDED: "HOMEWORK", HOMEWORK_GRADED: "HOMEWORK", HOMEWORK_SUBMITTED: "HOMEWORK", NEEDS_GRADING: "HOMEWORK",
  EXAM_ADDED: "EXAMS", EXAM_GRADED: "EXAMS", EXAM_COMPLETED: "EXAMS",
  MATERIAL_ADDED: "MATERIALS",
  ANNOUNCEMENT: "ANNOUNCEMENTS",
};

function categoryFor(type, category) {
  return CATEGORIES.includes(category) ? category : (TYPE_CATEGORY[type] || "ANNOUNCEMENTS");
}

async function preferencesFor(userIds, category) {
  const rows = await prisma.notificationPreference.findMany({ where: { userId: { in: userIds }, category } });
  return new Map(rows.map((row) => [row.userId, row]));
}

async function deliver(recipients, { type, category, title, body, link, dedupeKey }) {
  const userIds = [...new Set(recipients)];
  if (!userIds.length) return;
  const resolvedCategory = categoryFor(type, category);
  const preferenceMap = await preferencesFor(userIds, resolvedCategory);
  const inAppRecipients = userIds.filter((userId) => resolvedCategory === "SECURITY" || preferenceMap.get(userId)?.inAppEnabled !== false);
  const pushRecipients = userIds.filter((userId) => resolvedCategory === "SECURITY" || preferenceMap.get(userId)?.pushEnabled !== false);
  const notification = (userId, inAppVisible = true) => ({
    userId, type, category: resolvedCategory, title, body: body || null,
    inAppVisible,
    link: typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : null,
    ...(dedupeKey ? { dedupeKey: `${dedupeKey}:${userId}` } : {}),
  });

  if (dedupeKey) {
    const created = [];
    const recipientsWithAnyChannel = userIds.filter((userId) => inAppRecipients.includes(userId) || pushRecipients.includes(userId));
    await Promise.all(recipientsWithAnyChannel.map(async (userId) => {
      try { await prisma.notification.create({ data: notification(userId, inAppRecipients.includes(userId)) }); created.push(userId); }
      catch (error) { if (error.code !== "P2002") throw error; }
    }));
    const newlyCreated = new Set(created);
    const eligiblePush = pushRecipients.filter((userId) => newlyCreated.has(userId));
    if (eligiblePush.length) sendToUsers(eligiblePush, { title, body, url: link }).catch(() => {});
    return;
  }

  if (inAppRecipients.length) await prisma.notification.createMany({ data: inAppRecipients.map((userId) => notification(userId, true)) });
  if (pushRecipients.length) sendToUsers(pushRecipients, { title, body, url: link }).catch(() => {});
}

async function notifyStudents(studentIds, details) {
  if (!Array.isArray(studentIds) || !studentIds.length) return;
  const students = await prisma.student.findMany({
    where: { id: { in: [...new Set(studentIds)] } },
    select: { userId: true, user: { select: { isActive: true } } },
  });
  return deliver(students.filter((student) => student.user.isActive).map((student) => student.userId), details);
}

async function notifyTeacher(teacherId, details) {
  return deliver([teacherId], details);
}

async function notifyUser(userId, details) {
  return deliver([userId], details);
}

async function resolveTargetStudentIds({ courseId, visibility, grade, group, id, targetModel, targetField, teacherId }) {
  let candidateIds = null;

  if (courseId) {
    const enrollments = await prisma.courseEnrollment.findMany({ where: { courseId }, select: { studentId: true } });
    candidateIds = enrollments.map((e) => e.studentId);
  }

  let filtered;
  if (visibility === "ALL_STUDENTS") {
    filtered = candidateIds ?? (await prisma.student.findMany({ where: { ownerTeacherId: teacherId }, select: { id: true } })).map((s) => s.id);
  } else if (visibility === "GRADE") {
    const students = await prisma.student.findMany({ where: { grade }, select: { id: true } });
    filtered = students.map((s) => s.id);
  } else if (visibility === "GROUP") {
    const students = await prisma.student.findMany({ where: { grade, group }, select: { id: true } });
    filtered = students.map((s) => s.id);
  } else if (visibility === "SPECIFIC_STUDENTS") {
    const targets = await prisma[targetModel].findMany({ where: { [targetField]: id }, select: { studentId: true } });
    filtered = targets.map((t) => t.studentId);
  } else {
    filtered = [];
  }

  if (candidateIds) filtered = filtered.filter((sid) => candidateIds.includes(sid));
  if (teacherId) {
    const owned = await prisma.student.findMany({
      where: { id: { in: filtered }, ...(courseId ? {} : { ownerTeacherId: teacherId }) },
      select: { id: true },
    });
    filtered = owned.map((student) => student.id);
  }
  return filtered;
}

module.exports = { CATEGORIES, categoryFor, notifyStudents, notifyTeacher, notifyUser, resolveTargetStudentIds };
