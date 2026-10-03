const path = require("path");
const fs = require("fs");
const prisma = require("../config/db");
const { UPLOAD_ROOT } = require("../config/paths");
const { isString, isSafeHttpUrl, isUploadUrl, parseDate } = require("../utils/validate");
const logger = require("../utils/logger");
const storageService = require("../services/storageService");

const VISIBILITIES = ["ALL_STUDENTS", "GRADE", "GROUP", "SPECIFIC_STUDENTS"];
const isIdList = (v) => Array.isArray(v) && v.length <= 5000 && v.every((x) => isString(x, { min: 1, max: 64 }));
const isImageRef = (v) => isSafeHttpUrl(v) || isUploadUrl("image", v);

// Validates and normalizes the body shared by "add video to course" and
// "create general video". Returns { error } or { data } (data is ready for Prisma).
function parseVideoBody(body) {
  const { title, description, fileUrl, thumbnailUrl, visibility, grade, group, studentIds, startDate, expirationDate } = body || {};

  // fileUrl must be a file produced by OUR upload endpoint — not an arbitrary path.
  if (!isString(title, { min: 1, max: 200 }) || !isUploadUrl("video", fileUrl)) {
    return { error: "Title and video file are required." };
  }
  if (description != null && !isString(description, { max: 5000 })) return { error: "Invalid description." };
  if (thumbnailUrl != null && thumbnailUrl !== "" && !isImageRef(thumbnailUrl)) return { error: "Invalid thumbnail." };
  if (visibility != null && !VISIBILITIES.includes(visibility)) return { error: "Invalid visibility." };
  if (grade != null && !isString(grade, { max: 50 })) return { error: "Invalid grade." };
  if (group != null && !isString(group, { max: 50 })) return { error: "Invalid group." };
  if (studentIds != null && !isIdList(studentIds)) return { error: "Invalid students list." };

  const start = parseDate(startDate);
  const expiry = parseDate(expirationDate);
  if (start === undefined || expiry === undefined) return { error: "Invalid date." };

  return {
    data: {
      title: title.trim(),
      description: description ?? undefined,
      fileUrl,
      thumbnailUrl: thumbnailUrl || undefined,
      visibility: visibility || "ALL_STUDENTS",
      grade: grade ?? undefined,
      group: group ?? undefined,
      startDate: start,
      expirationDate: expiry,
      targets: Array.isArray(studentIds) ? { create: studentIds.map((studentId) => ({ studentId })) } : undefined,
    },
  };
}

// A video "belongs to the course's Videos tab" only if it was added there
// directly. Videos attached to a homework (explanation videos) or to a lesson
// also carry the course's id, but they belong to that homework/lesson and are
// shown inside it — never in the course's Videos tab.
const COURSE_TAB_VIDEOS = { homeworkId: null, lessonId: null };

// POST /api/teacher/courses
async function createCourse(req, res) {
  const { title, description, imageUrl, grade, group, studentIds, startDate, endDate } = req.body || {};

  if (!isString(title, { min: 1, max: 200 })) return res.status(400).json({ message: "Course title is required." });
  if (description != null && !isString(description, { max: 5000 })) return res.status(400).json({ message: "Invalid description." });
  if (imageUrl != null && imageUrl !== "" && !isImageRef(imageUrl)) return res.status(400).json({ message: "Invalid image." });
  if ((grade != null && !isString(grade, { max: 50 })) || (group != null && !isString(group, { max: 50 }))) {
    return res.status(400).json({ message: "Invalid grade or group." });
  }
  if (studentIds != null && !isIdList(studentIds)) return res.status(400).json({ message: "Invalid students list." });
  if (Array.isArray(studentIds) && studentIds.length) {
    const ownedCount = await prisma.student.count({ where: { id: { in: studentIds }, ownerTeacherId: req.user.id } });
    if (ownedCount !== new Set(studentIds).size || new Set(studentIds).size !== studentIds.length) return res.status(400).json({ message: "يمكن تسجيل طلابك فقط في هذا الكورس." });
  }
  const courseStart = parseDate(startDate);
  const courseEnd = parseDate(endDate);
  if (courseStart === undefined || courseEnd === undefined) return res.status(400).json({ message: "Invalid date." });

  const course = await prisma.course.create({
    data: {
      title,
      description,
      imageUrl,
      grade,
      group,
      startDate: courseStart,
      endDate: courseEnd,
      teacherId: req.user.id,
      status: "PUBLISHED",
      enrollments: Array.isArray(studentIds)
        ? { create: studentIds.map((studentId) => ({ studentId })) }
        : undefined,
      units: { create: { title: "الوحدة الأولى", position: 0 } },
    },
    include: { enrollments: true },
  });

  res.status(201).json({ course });
}

// GET /api/teacher/courses  (all courses belong to this teacher account)
async function listCourses(req, res) {
  const courses = await prisma.course.findMany({
    where: { teacherId: req.user.id },
    include: {
      _count: { select: { videos: { where: COURSE_TAB_VIDEOS }, homework: true, exams: true, materials: true, enrollments: { where: { student: { ownerTeacherId: req.user.id } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ courses });
}

// GET /api/teacher/courses/:courseId
// Returns the course together with ONLY the content that belongs to it —
// this is the isolation guarantee: every query below is scoped by courseId.
async function getCourseDetail(req, res) {
  const { courseId } = req.params;

  const course = await prisma.course.findFirst({
    where: { id: courseId, teacherId: req.user.id },
    include: {
      enrollments: { where: { student: { ownerTeacherId: req.user.id } }, include: { student: true } },
      lessons: true,
      units: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, include: { _count: { select: { videos: true, materials: true, homework: true } } } } } },
      videos: { where: COURSE_TAB_VIDEOS, orderBy: { createdAt: "desc" } }, // courseId === this course, added from the course's own Videos tab only
      homework: { include: { explanationVideos: { select: { id: true, title: true } } } }, // Homework.courseId === courseId
      materials: true,  // Material.courseId === courseId
      exams: true,       // Exam.courseId === courseId
      announcements: true,
    },
  });

  if (!course) return res.status(404).json({ message: "Course not found." });
  res.json({ course });
}

// POST /api/teacher/courses/:courseId/videos
// A video created here is ALWAYS scoped to this course via courseId.
// It is never inserted as a "general" video, and the general-videos
// endpoint (getGeneralVideos) explicitly excludes anything with a courseId.
async function addVideoToCourse(req, res) {
  const { courseId } = req.params;

  const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.user.id } });
  if (!course) return res.status(404).json({ message: "Course not found." });

  const { error, data } = parseVideoBody(req.body);
  if (error) return res.status(400).json({ message: error });

  const video = await prisma.video.create({
    data: {
      ...data,
      courseId: course.id, // <-- the isolation link
      createdById: req.user.id,
    },
  });

  res.status(201).json({ video });
}

// GET /api/teacher/videos/general
// Only videos that were explicitly created OUTSIDE any course/lesson/homework.
async function getGeneralVideos(req, res) {
  const videos = await prisma.video.findMany({
    where: {
      createdById: req.user.id,
      courseId: null,
      lessonId: null,
      homeworkId: null,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ videos });
}

// POST /api/teacher/courses/:courseId/enrollments  { studentIds: [] }
// Adds enrollments — this is what actually makes a course (and its content)
// visible to a student. Safe to call repeatedly (skips duplicates).
async function enrollStudents(req, res) {
  const { courseId } = req.params;
  const { studentIds } = req.body || {};
  if (!isIdList(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ message: "يجب اختيار طالب واحد على الأقل." });
  }

  const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.user.id } });
  if (!course) return res.status(404).json({ message: "Course not found." });

  const ownedStudentCount = await prisma.student.count({ where: { id: { in: studentIds }, ownerTeacherId: req.user.id } });
  if (ownedStudentCount !== new Set(studentIds).size || new Set(studentIds).size !== studentIds.length) return res.status(400).json({ message: "يمكن تسجيل طلابك فقط في هذا الكورس." });

  const existing = await prisma.courseEnrollment.findMany({
    where: { courseId, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((e) => e.studentId));
  const toCreate = studentIds.filter((id) => !existingIds.has(id));

  if (toCreate.length) {
    await prisma.courseEnrollment.createMany({
      data: toCreate.map((studentId) => ({ courseId, studentId })),
    });
  }

  res.status(201).json({ added: toCreate.length });
}

// DELETE /api/teacher/courses/:courseId/enrollments/:studentId
async function unenrollStudent(req, res) {
  const { courseId, studentId } = req.params;
  const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.user.id }, select: { id: true } });
  if (!course) return res.status(404).json({ message: "Course not found." });
  await prisma.courseEnrollment.deleteMany({ where: { courseId, studentId } });
  res.json({ message: "تم إلغاء تسجيل الطالب من الكورس." });
}

module.exports = {
  createCourse, listCourses, getCourseDetail, addVideoToCourse, getGeneralVideos,
  createGeneralVideo, deleteVideo, enrollStudents, unenrollStudent,
};

// POST /api/teacher/videos  (general video, NOT linked to any course/lesson/homework)
async function createGeneralVideo(req, res) {
  const { error, data } = parseVideoBody(req.body);
  if (error) return res.status(400).json({ message: error });

  const video = await prisma.video.create({
    data: {
      ...data,
      // courseId/lessonId/homeworkId intentionally omitted => general content
      createdById: req.user.id,
    },
  });

  res.status(201).json({ video });
}

module.exports.createGeneralVideo = createGeneralVideo;

// DELETE /api/teacher/videos/:videoId — works for both general and course videos.
async function deleteVideo(req, res) {
  const video = await prisma.video.findUnique({ where: { id: req.params.videoId } });
  if (!video) return res.status(404).json({ message: "Video not found." });
  if (video.createdById !== req.user.id) {
    return res.status(403).json({ message: "You do not have permission to delete this video." });
  }
  await prisma.video.delete({ where: { id: video.id } });

  // Remove the file too, unless another record still points at it — otherwise
  // deleted videos pile up on disk forever.
  try {
    const stillUsed = await prisma.video.count({ where: { fileUrl: video.fileUrl } });
    if (!stillUsed) {
      const rel = video.fileUrl.replace(/^\/?uploads\//, "");
      if (storageService.isRemoteEnabled) {
        await storageService.deleteRemoteObject(rel);
      } else {
        const full = path.resolve(UPLOAD_ROOT, rel);
        if (full.startsWith(UPLOAD_ROOT + path.sep)) fs.unlink(full, () => {});
      }
    }
  } catch (err) {
    logger.warn("Could not remove video file", { error: err.message });
  }

  res.json({ message: "Video deleted." });
}

module.exports.deleteVideo = deleteVideo;
