const prisma = require("../config/db");
const { visibilityFilter, withExpiryFlag } = require("./studentContentController");
const { isString } = require("../utils/validate");
const { audit } = require("../services/auditService");

const VISIBILITIES = ["ALL_STUDENTS", "GRADE", "GROUP", "SPECIFIC_STUDENTS"];
const validIds = (ids) => Array.isArray(ids) && ids.length <= 5000 && ids.every((id) => isString(id, { min: 1, max: 64 }));

async function getOwnedCourse(courseId, teacherId) {
  if (!courseId) return null;
  return prisma.course.findFirst({ where: { id: courseId, teacherId }, select: { id: true } });
}

async function chooseUnit(courseId, unitId) {
  if (!courseId) return unitId ? null : { id: null };
  if (unitId) return prisma.unit.findFirst({ where: { id: unitId, courseId }, select: { id: true } });
  return prisma.unit.findFirst({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } });
}

async function nextPosition(unitId) {
  if (!unitId) return 0;
  const aggregate = await prisma.lesson.aggregate({ where: { unitId }, _max: { position: true } });
  return (aggregate._max.position ?? -1) + 1;
}

async function validTargets({ studentIds, visibility, courseId, teacherId }) {
  if (studentIds == null) return true;
  if (!validIds(studentIds)) return false;
  if (visibility !== "SPECIFIC_STUDENTS") return studentIds.length === 0;
  if (!studentIds.length) return false;
  const where = courseId
    ? { courseId, studentId: { in: studentIds }, course: { teacherId } }
    : { studentId: { in: studentIds }, student: { ownerTeacherId: teacherId } };
  const count = courseId ? await prisma.courseEnrollment.count({ where }) : await prisma.student.count({ where: { id: { in: studentIds }, ownerTeacherId: teacherId } });
  return count === studentIds.length;
}

async function createLesson(req, res) {
  const body = req.body || {};
  const { title, description, date, courseId, unitId, visibility = "ALL_STUDENTS", grade, group, studentIds } = body;
  if (!isString(title, { min: 1, max: 200 }) || (description != null && !isString(description, { max: 5000 })) || !VISIBILITIES.includes(visibility)) return res.status(400).json({ message: "بيانات الدرس غير صالحة." });
  const lessonDate = date ? new Date(date) : null;
  if (date && Number.isNaN(lessonDate.getTime())) return res.status(400).json({ message: "تاريخ الدرس غير صالح." });
  if ((grade != null && !isString(grade, { max: 50 })) || (group != null && !isString(group, { max: 50 }))) return res.status(400).json({ message: "الصف أو المجموعة غير صالحين." });
  if (courseId && !(await getOwnedCourse(courseId, req.user.id))) return res.status(404).json({ message: "الكورس غير موجود." });
  const unit = await chooseUnit(courseId || null, unitId);
  if (!unit) return res.status(400).json({ message: "الوحدة لا تتبع هذا الكورس." });
  if (!(await validTargets({ studentIds, visibility, courseId, teacherId: req.user.id }))) return res.status(400).json({ message: "قائمة الطلاب المستهدفين غير صالحة." });
  const lesson = await prisma.lesson.create({
    data: {
      title: title.trim(), description: description?.trim() || null, date: lessonDate,
      courseId: courseId || null, unitId: unit.id, position: await nextPosition(unit.id),
      createdById: req.user.id, visibility, grade: grade || null, group: group || null,
      ...(Array.isArray(studentIds) && studentIds.length ? { targets: { create: studentIds.map((studentId) => ({ studentId })) } } : {}),
    },
  });
  audit(req, "lesson_created", { targetType: "lesson", targetId: lesson.id });
  res.status(201).json({ lesson });
}

async function listLessons(req, res) {
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  if (courseId && !(await getOwnedCourse(courseId, req.user.id))) return res.status(404).json({ message: "الكورس غير موجود." });
  const lessons = await prisma.lesson.findMany({
    where: { createdById: req.user.id, ...(courseId ? { courseId } : {}) },
    include: { unit: { select: { id: true, title: true, position: true } }, _count: { select: { videos: true, materials: true, homework: true } } },
    orderBy: [{ unit: { position: "asc" } }, { position: "asc" }, { createdAt: "asc" }],
  });
  res.json({ lessons });
}

async function getLesson(req, res) {
  const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, createdById: req.user.id }, include: { videos: true, materials: true, homework: true, course: true, unit: true } });
  if (!lesson) return res.status(404).json({ message: "الدرس غير موجود." });
  res.json({ lesson });
}

async function updateLesson(req, res) {
  const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, createdById: req.user.id } });
  if (!lesson) return res.status(404).json({ message: "الدرس غير موجود." });
  const body = req.body || {};
  const { title, description, date, visibility, grade, group } = body;
  if ((title !== undefined && !isString(title, { min: 1, max: 200 })) || (description !== undefined && description != null && !isString(description, { max: 5000 })) || (visibility !== undefined && !VISIBILITIES.includes(visibility)) || (grade !== undefined && grade != null && !isString(grade, { max: 50 })) || (group !== undefined && group != null && !isString(group, { max: 50 }))) return res.status(400).json({ message: "بيانات الدرس غير صالحة." });
  let parsedDate;
  if (date !== undefined) {
    parsedDate = date ? new Date(date) : null;
    if (date && Number.isNaN(parsedDate.getTime())) return res.status(400).json({ message: "تاريخ الدرس غير صالح." });
  }
  const nextUnitId = body.unitId !== undefined ? body.unitId : lesson.unitId;
  if (body.unitId !== undefined && !(await chooseUnit(lesson.courseId, body.unitId))) return res.status(400).json({ message: "الوحدة لا تتبع هذا الكورس." });
  const effectiveVisibility = visibility || lesson.visibility;
  if (body.studentIds !== undefined && !(await validTargets({ studentIds: body.studentIds, visibility: effectiveVisibility, courseId: lesson.courseId, teacherId: req.user.id }))) return res.status(400).json({ message: "قائمة الطلاب المستهدفين غير صالحة." });
  const data = {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(description !== undefined ? { description: description?.trim() || null } : {}),
    ...(date !== undefined ? { date: parsedDate } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(grade !== undefined ? { grade: grade || null } : {}),
    ...(group !== undefined ? { group: group || null } : {}),
    ...(body.unitId !== undefined ? { unitId: nextUnitId, position: await nextPosition(nextUnitId) } : {}),
  };
  if (body.studentIds !== undefined) {
    await prisma.lessonTarget.deleteMany({ where: { lessonId: lesson.id } });
    if (body.studentIds.length) data.targets = { create: body.studentIds.map((studentId) => ({ studentId })) };
  }
  const updated = await prisma.lesson.update({ where: { id: lesson.id }, data });
  audit(req, "lesson_updated", { targetType: "lesson", targetId: lesson.id });
  res.json({ lesson: updated });
}

async function duplicateLesson(req, res) {
  const original = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, createdById: req.user.id }, include: { targets: true } });
  if (!original) return res.status(404).json({ message: "الدرس غير موجود." });
  const copy = await prisma.lesson.create({
    data: {
      title: `${original.title} — نسخة`, description: original.description, date: null,
      courseId: original.courseId, unitId: original.unitId, position: await nextPosition(original.unitId),
      createdById: req.user.id, visibility: original.visibility, grade: original.grade, group: original.group,
      ...(original.targets.length ? { targets: { create: original.targets.map((target) => ({ studentId: target.studentId })) } } : {}),
    },
  });
  audit(req, "lesson_duplicated", { targetType: "lesson", targetId: copy.id, details: { sourceLessonId: original.id } });
  res.status(201).json({ lesson: copy, attachmentsCopied: false });
}

async function deleteLesson(req, res) {
  const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, createdById: req.user.id }, select: { id: true } });
  if (!lesson) return res.status(404).json({ message: "الدرس غير موجود." });
  await prisma.lesson.delete({ where: { id: lesson.id } });
  audit(req, "lesson_deleted", { targetType: "lesson", targetId: lesson.id });
  res.json({ message: "تم حذف الدرس." });
}

async function studentScope(student) {
  const enrollments = await prisma.courseEnrollment.findMany({ where: { studentId: student.id, course: { status: "PUBLISHED" } }, select: { courseId: true } });
  return { AND: [visibilityFilter(student, "targets"), { OR: [{ courseId: null }, { courseId: { in: enrollments.map((e) => e.courseId) } }] }] };
}

async function getMyLessons(req, res) {
  const student = req.user.studentProfile;
  const lessons = await prisma.lesson.findMany({ where: await studentScope(student), include: { unit: true, course: { select: { id: true, title: true } } }, orderBy: [{ unit: { position: "asc" } }, { position: "asc" }, { createdAt: "asc" }] });
  res.json({ lessons });
}

async function getMyLessonDetail(req, res) {
  const student = req.user.studentProfile;
  const scope = await studentScope(student);
  const lesson = await prisma.lesson.findFirst({
    where: { id: req.params.lessonId, ...scope },
    include: {
      unit: { select: { id: true, title: true } }, course: { select: { id: true, title: true } },
      videos: { where: visibilityFilter(student, "targets"), orderBy: { createdAt: "asc" } },
      materials: {
        where: { AND: [visibilityFilter(student, "targets", { requirePublished: false }), { homeworkId: null }] },
      },
      homework: {
        where: visibilityFilter(student, "targets"),
        include: {
          submissions: { where: { studentId: student.id } },
          explanationVideos: true,
          materials: { where: visibilityFilter(student, "targets", { requirePublished: false }) },
        },
      },
      progress: { where: { studentId: student.id }, select: { completedAt: true } },
    },
  });
  if (!lesson) return res.status(404).json({ message: "الدرس غير موجود." });
  lesson.videos = withExpiryFlag(lesson.videos);
  lesson.homework = lesson.homework.map((item) => ({ ...item, mySubmission: item.submissions[0] || null, submissions: undefined, explanationVideos: withExpiryFlag(item.explanationVideos) }));
  res.json({ lesson });
}

async function updateMyLessonProgress(req, res) {
  if (typeof req.body?.completed !== "boolean") return res.status(400).json({ message: "حالة إكمال الدرس غير صالحة." });
  const student = req.user.studentProfile;
  const scope = await studentScope(student);
  const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, ...scope }, select: { id: true } });
  if (!lesson) return res.status(404).json({ message: "الدرس غير موجود." });
  const progress = await prisma.lessonProgress.upsert({
    where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
    create: { lessonId: lesson.id, studentId: student.id, completedAt: req.body.completed ? new Date() : null },
    update: { completedAt: req.body.completed ? new Date() : null },
  });
  res.json({ completedAt: progress.completedAt });
}

module.exports = { createLesson, listLessons, getLesson, updateLesson, duplicateLesson, deleteLesson, getMyLessons, getMyLessonDetail, updateMyLessonProgress };
