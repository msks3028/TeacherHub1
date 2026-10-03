const prisma = require("../config/db");
const { visibilityFilter } = require("./studentContentController");
const { str } = require("../utils/validate");
const { teacherContentWhere } = require("../services/contentOwnership");

// GET /api/teacher/search?q=
async function teacherSearch(req, res) {
  const q = str(req.query.q, 100); // always a plain, length-limited string
  if (!q) return res.json({ results: {} });

  const like = { contains: q, mode: "insensitive" };

  const [students, courses, videos, lessons, homework, exams, materials, announcements] = await Promise.all([
    prisma.student.findMany({ where: { fullName: like, ownerTeacherId: req.user.id }, take: 10 }),
    prisma.course.findMany({ where: { teacherId: req.user.id, title: like }, take: 10 }),
    prisma.video.findMany({ where: { createdById: req.user.id, title: like }, take: 10 }),
    prisma.lesson.findMany({ where: { title: like, OR: [{ createdById: req.user.id }, { course: { is: { teacherId: req.user.id } } }] }, take: 10 }),
    prisma.homework.findMany({ where: { AND: [teacherContentWhere(req.user.id), { title: like }] }, take: 10 }),
    prisma.exam.findMany({ where: { AND: [teacherContentWhere(req.user.id), { title: like }] }, take: 10 }),
    prisma.material.findMany({ where: { AND: [teacherContentWhere(req.user.id), { title: like }] }, take: 10 }),
    prisma.announcement.findMany({ where: { AND: [teacherContentWhere(req.user.id), { title: like }] }, take: 10 }),
  ]);

  res.json({ results: { students, courses, videos, lessons, homework, exams, materials, announcements } });
}

// GET /api/student/search?q=  -> searches only within the student's own visible content
async function studentSearch(req, res) {
  const q = str(req.query.q, 100);
  if (!q) return res.json({ results: {} });

  const student = req.user.studentProfile;
  const enrolledCourseIds = (
    await prisma.courseEnrollment.findMany({ where: { studentId: student.id, course: { status: "PUBLISHED" } }, select: { courseId: true } })
  ).map((e) => e.courseId);

  const like = { contains: q, mode: "insensitive" };
  const scopeFilter = { OR: [{ courseId: null }, { courseId: { in: enrolledCourseIds } }] };
  const visFilter = visibilityFilter(student, "targets");

  const [courses, videos, homework, materials] = await Promise.all([
    prisma.course.findMany({ where: { id: { in: enrolledCourseIds }, title: like }, take: 10 }),
    prisma.video.findMany({ where: { AND: [scopeFilter, visFilter, { title: like }] }, take: 10 }),
    prisma.homework.findMany({ where: { AND: [scopeFilter, visFilter, { title: like }] }, take: 10 }),
    prisma.material.findMany({ where: { AND: [scopeFilter, visFilter, { title: like }] }, take: 10 }),
  ]);

  res.json({ results: { courses, videos, homework, materials } });
}

module.exports = { teacherSearch, studentSearch };
