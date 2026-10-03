const prisma = require("../config/db");
const { notifyStudents, resolveTargetStudentIds } = require("../services/notificationService");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { teacherContentWhere, teacherOwnsCourse, teacherOwnsTargets } = require("../services/contentOwnership");

function targetsData(studentIds) {
  return Array.isArray(studentIds) ? { create: studentIds.map((studentId) => ({ studentId })) } : undefined;
}

// POST /api/teacher/announcements
async function createAnnouncement(req, res) {
  const { title, body, courseId, scope, grade, group, studentIds } = req.body;
  if (!title || !body) return res.status(400).json({ message: "Title and body are required." });
  if (!(await teacherOwnsCourse(req.user.id, courseId)) || !(await teacherOwnsTargets(req.user.id, studentIds))) {
    return res.status(404).json({ message: "Course or student not found." });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title, body, courseId: courseId || null,
      scope: scope || "ALL_STUDENTS", grade, group,
      createdById: req.user.id,
      targets: targetsData(studentIds),
    },
  });

  const targetIds = await resolveTargetStudentIds({
    courseId: announcement.courseId, visibility: announcement.scope, grade: announcement.grade,
    group: announcement.group, id: announcement.id, targetModel: "announcementTarget", targetField: "announcementId", teacherId: req.user.id,
  });
  await notifyStudents(targetIds, {
    type: "ANNOUNCEMENT", title: "إعلان جديد", body: announcement.title, link: `/student/announcements`,
  });

  res.status(201).json({ announcement });
}

// GET /api/teacher/announcements?page=&limit=
async function listAnnouncements(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({ where: teacherContentWhere(req.user.id), orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.announcement.count({ where: teacherContentWhere(req.user.id) }),
  ]);
  res.json({ announcements, pagination: buildMeta(page, limit, total) });
}

// DELETE /api/teacher/announcements/:id
async function deleteAnnouncement(req, res) {
  const owned = await prisma.announcement.findFirst({ where: { id: req.params.announcementId, createdById: req.user.id } });
  if (!owned) return res.status(404).json({ message: "Announcement not found." });
  await prisma.announcement.delete({ where: { id: owned.id } });
  res.json({ message: "Announcement deleted." });
}

// GET /api/student/announcements
async function getMyAnnouncements(req, res) {
  const student = req.user.studentProfile;
  const enrolledCourseIds = (
    await prisma.courseEnrollment.findMany({ where: { studentId: student.id, course: { status: "PUBLISHED" } }, select: { courseId: true } })
  ).map((e) => e.courseId);

  const announcements = await prisma.announcement.findMany({
    where: {
      AND: [
        {
          OR: [
            { scope: "ALL_STUDENTS" },
            { scope: "GRADE", grade: student.grade },
            { scope: "GROUP", group: student.group },
            { scope: "SPECIFIC_STUDENTS", targets: { some: { studentId: student.id } } },
          ],
        },
        { OR: [{ courseId: { in: enrolledCourseIds } }, { courseId: null, createdById: student.ownerTeacherId || "__no_teacher__" }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ announcements });
}

module.exports = { createAnnouncement, listAnnouncements, deleteAnnouncement, getMyAnnouncements };
