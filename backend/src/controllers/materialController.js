const prisma = require("../config/db");
const { visibilityFilter } = require("./studentContentController");
const { notifyStudents, resolveTargetStudentIds } = require("../services/notificationService");
const { isString, isUploadUrl } = require("../utils/validate");
const { teacherContentWhere, teacherOwnsCourse, teacherOwnsTargets } = require("../services/contentOwnership");

const VISIBILITIES = ["ALL_STUDENTS", "GRADE", "GROUP", "SPECIFIC_STUDENTS"];

function targetsData(studentIds) {
  return Array.isArray(studentIds) ? { create: studentIds.map((studentId) => ({ studentId })) } : undefined;
}

// POST /api/teacher/materials
async function createMaterial(req, res) {
  const { title, fileUrl, allowDownload, courseId, lessonId, homeworkId, visibility, grade, group, studentIds } = req.body || {};
  const effectiveVisibility = visibility || "ALL_STUDENTS";
  const effectiveCourseId = courseId || null;
  const effectiveLessonId = lessonId || null;
  const effectiveHomeworkId = homeworkId || null;
  // fileUrl must be a PDF produced by OUR upload endpoint, not an arbitrary path.
  if (!isString(title, { min: 1, max: 200 }) || !isUploadUrl("pdf", fileUrl)) {
    return res.status(400).json({ message: "Title and file are required." });
  }
  if (visibility != null && !VISIBILITIES.includes(visibility)) return res.status(400).json({ message: "Invalid visibility." });
  if ((grade != null && !isString(grade, { max: 50 })) || (group != null && !isString(group, { max: 50 })) ||
      (effectiveVisibility === "GRADE" && !isString(grade, { min: 1, max: 50 })) ||
      (effectiveVisibility === "GROUP" && !isString(group, { min: 1, max: 50 }))) {
    return res.status(400).json({ message: "Invalid grade or group." });
  }
  if ([courseId, lessonId, homeworkId].some((v) => v != null && !isString(v, { max: 64 }))) {
    return res.status(400).json({ message: "Invalid reference." });
  }
  if (studentIds != null && !(Array.isArray(studentIds) && studentIds.length <= 5000 && studentIds.every((x) => isString(x, { min: 1, max: 64 })) && new Set(studentIds).size === studentIds.length)) {
    return res.status(400).json({ message: "Invalid students list." });
  }
  if (effectiveVisibility === "SPECIFIC_STUDENTS" && (!Array.isArray(studentIds) || studentIds.length === 0)) {
    return res.status(400).json({ message: "اختر طالبًا واحدًا على الأقل لهذا الملف." });
  }
  if (effectiveVisibility !== "SPECIFIC_STUDENTS" && studentIds?.length) {
    return res.status(400).json({ message: "قائمة الطلاب لا تتوافق مع إعداد الظهور المحدد." });
  }
  if (!(await teacherOwnsCourse(req.user.id, effectiveCourseId)) || !(await teacherOwnsTargets(req.user.id, studentIds))) {
    return res.status(404).json({ message: "Course or student not found." });
  }

  if (effectiveLessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: effectiveLessonId, OR: [{ createdById: req.user.id }, { course: { is: { teacherId: req.user.id } } }] },
      select: { id: true, courseId: true },
    });
    if (!lesson || lesson.courseId !== effectiveCourseId) return res.status(404).json({ message: "Lesson not found in this course." });
  }

  if (effectiveHomeworkId) {
    const homework = await prisma.homework.findFirst({
      where: {
        id: effectiveHomeworkId,
        OR: [
          { createdById: req.user.id },
          { course: { is: { teacherId: req.user.id } } },
          { lesson: { is: { createdById: req.user.id } } },
        ],
      },
      select: { id: true, courseId: true, lessonId: true },
    });
    if (!homework) return res.status(404).json({ message: "Homework not found." });
    if (homework.courseId !== effectiveCourseId || homework.lessonId !== effectiveLessonId) {
      return res.status(400).json({ message: "Material references must match the selected homework and lesson." });
    }
  }

  if (effectiveVisibility === "SPECIFIC_STUDENTS" && effectiveCourseId) {
    const enrolledCount = await prisma.courseEnrollment.count({ where: { courseId: effectiveCourseId, studentId: { in: studentIds } } });
    if (enrolledCount !== studentIds.length) return res.status(400).json({ message: "اختر طلابًا مسجّلين في هذا الكورس فقط." });
  }

  const material = await prisma.material.create({
    data: {
      title: title.trim(), fileUrl, allowDownload: allowDownload === true,
      courseId: effectiveCourseId, lessonId: effectiveLessonId, homeworkId: effectiveHomeworkId,
      createdById: req.user.id,
      visibility: effectiveVisibility, grade: grade || null, group: group || null,
      targets: targetsData(studentIds),
    },
  });

  const targetIds = await resolveTargetStudentIds({
    courseId: material.courseId, visibility: material.visibility, grade: material.grade,
    group: material.group, id: material.id, targetModel: "materialTarget", targetField: "materialId", teacherId: req.user.id,
  });
  await notifyStudents(targetIds, {
    type: "MATERIAL_ADDED", title: "ملف جديد", body: material.title, link: `/student/materials`,
  });

  res.status(201).json({ material });
}

// GET /api/teacher/materials?courseId=
// GET /api/teacher/materials?courseId=
// With no courseId, this is the "general materials" list — course-scoped
// materials must never leak into it (same isolation rule as videos).
async function listMaterials(req, res) {
  const { courseId } = req.query;
  const materials = await prisma.material.findMany({
    where: { AND: [courseId ? { courseId } : { courseId: null }, teacherContentWhere(req.user.id)] },
    orderBy: { createdAt: "desc" },
  });
  res.json({ materials });
}

// DELETE /api/teacher/materials/:materialId
async function deleteMaterial(req, res) {
  if (!(await teacherOwnsContent("material", req.params.materialId, req.user.id))) return res.status(404).json({ message: "Material not found." });
  await prisma.material.delete({ where: { id: req.params.materialId } });
  res.json({ message: "Material deleted." });
}

// GET /api/student/materials
// GET /api/student/materials — ONLY general (non-course) materials. Course
// materials live exclusively inside that course's own page.
async function getMyMaterials(req, res) {
  const student = req.user.studentProfile;

  const materials = await prisma.material.findMany({
    where: {
      AND: [
        visibilityFilter(student, "targets", { requirePublished: false }),
        { courseId: null, lessonId: null, homeworkId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ materials });
}

module.exports = { createMaterial, listMaterials, deleteMaterial, getMyMaterials };
