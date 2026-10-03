const prisma = require("../config/db");

function teacherContentWhere(teacherId) {
  return { OR: [{ createdById: teacherId }, { course: { is: { teacherId } } }] };
}

async function teacherOwnsContent(modelName, id, teacherId) {
  const model = prisma[modelName];
  if (!model?.findUnique) throw new Error(`Unsupported content model: ${modelName}`);
  const row = await model.findUnique({ where: { id } });
  if (!row) return false;
  if (row.createdById === teacherId) return true;
  if (row.courseId && await prisma.course.findFirst({ where: { id: row.courseId, teacherId }, select: { id: true } })) return true;
  if (row.lessonId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: row.lessonId }, select: { createdById: true, course: { select: { teacherId: true } } } });
    if (lesson?.createdById === teacherId || lesson?.course?.teacherId === teacherId) return true;
  }
  if (row.homeworkId) {
    const homework = await prisma.homework.findUnique({ where: { id: row.homeworkId }, select: { createdById: true, course: { select: { teacherId: true } } } });
    if (homework?.createdById === teacherId || homework?.course?.teacherId === teacherId) return true;
  }
  return false;
}

async function teacherOwnsCourse(teacherId, courseId) {
  if (!courseId) return true;
  return !!(await prisma.course.findFirst({ where: { id: courseId, teacherId }, select: { id: true } }));
}

async function teacherOwnsLesson(teacherId, lessonId, courseId) {
  if (!lessonId) return true;
  const where = { id: lessonId, OR: [{ createdById: teacherId }, { course: { is: { teacherId } } }] };
  if (courseId) where.courseId = courseId;
  return !!(await prisma.lesson.findFirst({ where, select: { id: true } }));
}

async function teacherOwnsTargets(teacherId, studentIds) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) return true;
  const ids = [...new Set(studentIds)];
  const count = await prisma.student.count({ where: { id: { in: ids }, ownerTeacherId: teacherId } });
  return count === ids.length;
}

module.exports = { teacherContentWhere, teacherOwnsContent, teacherOwnsCourse, teacherOwnsLesson, teacherOwnsTargets };
