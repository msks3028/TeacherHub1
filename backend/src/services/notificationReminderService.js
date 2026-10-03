const prisma = require("../config/db");
const logger = require("../utils/logger");
const { notifyStudents, resolveTargetStudentIds } = require("./notificationService");

async function sendForTarget({ record, teacherId, title, category, type, link, targetModel, targetField, targetId }) {
  const recipientIds = await resolveTargetStudentIds({
    courseId: record.courseId, visibility: record.visibility, grade: record.grade, group: record.group,
    id: targetId || record.id, targetModel, targetField, teacherId,
  });
  if (!recipientIds.length) return;
  await notifyStudents(recipientIds, {
    type, category, title, body: record.title, link,
    dedupeKey: `reminder:${category.toLowerCase()}:${record.id}:24h`,
  });
}

async function runNotificationReminders(now = new Date()) {
  const lower = new Date(now.getTime() + 24 * 60 * 60_000 - 5 * 60_000);
  const upper = new Date(now.getTime() + 24 * 60 * 60_000 + 5 * 60_000);
  const [homework, exams, liveClasses] = await Promise.all([
    prisma.homework.findMany({ where: { status: "PUBLISHED", deadline: { gte: lower, lt: upper } }, select: { id: true, title: true, courseId: true, visibility: true, grade: true, group: true, createdById: true } }),
    prisma.exam.findMany({ where: { status: "PUBLISHED", startDate: { gte: lower, lt: upper } }, include: { course: { select: { teacherId: true, status: true } } } }),
    prisma.liveClass.findMany({
      where: { status: "SCHEDULED", cancelledAt: null, startsAt: { gte: new Date(now.getTime() + 10 * 60_000), lt: new Date(now.getTime() + 20 * 60_000) }, OR: [{ courseId: null }, { course: { status: "PUBLISHED" } }] },
      include: { targets: { select: { studentId: true } } },
    }),
  ]);

  for (const record of homework) {
    await sendForTarget({ record, teacherId: record.createdById, title: "تذكير: موعد تسليم الواجب خلال 24 ساعة", category: "HOMEWORK", type: "HOMEWORK_ADDED", link: `/student/homework/${record.id}`, targetModel: "homeworkTarget", targetField: "homeworkId" });
  }
  for (const record of exams) {
    const teacherId = record.createdById || record.course?.teacherId;
    if (!teacherId || record.course?.status === "DRAFT") continue;
    await sendForTarget({ record, teacherId, title: "تذكير: يبدأ الاختبار خلال 24 ساعة", category: "EXAMS", type: "EXAM_ADDED", link: `/student/exams/${record.id}`, targetModel: "examTarget", targetField: "examId" });
  }
  for (const record of liveClasses) {
    const recipientIds = await resolveTargetStudentIds({ courseId: record.courseId, visibility: record.visibility, grade: record.grade, group: record.group, id: record.id, targetModel: "liveClassTarget", targetField: "liveClassId", teacherId: record.teacherId });
    if (recipientIds.length) await notifyStudents(recipientIds, {
      type: "ANNOUNCEMENT", category: "LIVE_CLASSES", title: "تذكير: الحصة المباشرة تبدأ قريبًا", body: record.title,
      link: "/student/live-classes", dedupeKey: `reminder:live-class:${record.id}:15m`,
    });
  }
  return { homework: homework.length, exams: exams.length, liveClasses: liveClasses.length };
}

function startNotificationReminderScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await runNotificationReminders(); }
    catch (error) { logger.warn("Notification reminder run failed", { error: error.message }); }
    finally { running = false; }
  };
  const timer = setInterval(run, 5 * 60_000);
  timer.unref?.();
  run();
  return () => clearInterval(timer);
}

module.exports = { runNotificationReminders, startNotificationReminderScheduler };
