const prisma = require("../config/db");
const { withPassed } = require("../services/examScoring");

/**
 * Builds a Prisma "OR" filter that expresses: "this content is visible to
 * THIS student" — reused by every /student/* endpoint below so the rule
 * lives in one place instead of being re-implemented (and possibly
 * forgotten) per route.
 *
 * A row is visible if:
 *  - visibility = ALL_STUDENTS, or
 *  - visibility = GRADE and it matches the student's grade, or
 *  - visibility = GROUP and it matches the student's group, or
 *  - visibility = SPECIFIC_STUDENTS and the student is in the *Target join table
 */
function visibilityFilter(student, targetRelationName, { requirePublished = true } = {}) {
  return {
    AND: [
      ...(requirePublished ? [{ status: "PUBLISHED" }] : []),
      // Course content is gated by enrollment at the calling route. General
      // content belongs to the student's assigned teacher only.
      { OR: [{ courseId: { not: null } }, { createdById: student.ownerTeacherId || "__no_teacher__" }] },
      { OR: [
        { visibility: "ALL_STUDENTS" },
        { visibility: "GRADE", grade: student.grade },
        { visibility: "GROUP", group: student.group },
        { visibility: "SPECIFIC_STUDENTS", [targetRelationName]: { some: { studentId: student.id } } },
      ] },
    ],
  };
}

// Videos that live in a container (a homework's explanation video, a lesson
// video) must never show up as standalone videos — neither in a course's
// Videos tab nor in the general Videos page. They appear inside their
// homework / lesson only.
const STANDALONE_VIDEO = { homeworkId: null, lessonId: null };

// Adds `isExpired` to each video so the player can show "no longer available"
// instead of a blank screen. (The server still refuses to stream an expired
// video — this flag is only for display.)
function withExpiryFlag(videos = []) {
  const now = new Date();
  return videos.map((v) => ({ ...v, isExpired: !!(v.expirationDate && v.expirationDate < now) }));
}

// GET /api/student/courses  -> only courses the student is enrolled in
async function getMyCourses(req, res) {
  const student = req.user.studentProfile;

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId: student.id, course: { status: "PUBLISHED" } },
    include: {
      course: {
        include: { _count: { select: { videos: { where: STANDALONE_VIDEO }, homework: true, exams: true, materials: true } } },
      },
    },
  });

  res.json({ courses: enrollments.map((e) => e.course) });
}

// GET /api/student/courses/:courseId
// Returns 404 (not 403) if the student isn't enrolled, so a probing
// request can't distinguish "doesn't exist" from "not yours".
async function getMyCourseDetail(req, res) {
  const student = req.user.studentProfile;
  const { courseId } = req.params;

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { courseId, studentId: student.id, course: { is: { status: "PUBLISHED" } } },
  });
  if (!enrollment) return res.status(404).json({ message: "Course not found." });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      videos: {
        where: { AND: [visibilityFilter(student, "targets"), STANDALONE_VIDEO] },
        orderBy: { createdAt: "desc" },
      },
      homework: {
        where: { AND: [visibilityFilter(student, "targets"), { lessonId: null }] },
        include: {
          submissions: { where: { studentId: student.id } },
          explanationVideos: true,
          materials: { where: visibilityFilter(student, "targets", { requirePublished: false }) },
        },
      },
      materials: {
        where: {
          AND: [visibilityFilter(student, "targets", { requirePublished: false }), { lessonId: null, homeworkId: null }],
        },
      },
      exams: {
        where: visibilityFilter(student, "targets"),
        include: { attempts: { where: { studentId: student.id } }, _count: { select: { questions: true } } },
      },
      lessons: { where: visibilityFilter(student, "targets"), orderBy: [{ unit: { position: "asc" } }, { position: "asc" }] },
      units: {
        orderBy: { position: "asc" },
        include: { lessons: { where: visibilityFilter(student, "targets"), orderBy: { position: "asc" } } },
      },
    },
  });

  if (course) {
    course.homework = course.homework.map((h) => ({
      ...h,
      mySubmission: h.submissions[0] || null,
      submissions: undefined,
      explanationVideos: withExpiryFlag(h.explanationVideos),
    }));
    course.videos = withExpiryFlag(course.videos);
    course.exams = course.exams.map((e) => ({ ...e, myAttempts: e.attempts.map((a) => withPassed(a, e)), attempts: undefined }));
  }

  res.json({ course });
}

// GET /api/student/videos -> ONLY videos this student is allowed to see,
// server-computed. The frontend never receives videos it must then hide.
// GET /api/student/videos — ONLY general (non-course) videos. Course videos
// live exclusively inside that course's own page (getMyCourseDetail), never
// duplicated here — same isolation rule as everywhere else in the platform.
async function getMyVideos(req, res) {
  const student = req.user.studentProfile;
  const now = new Date();

  const videos = await prisma.video.findMany({
    where: {
      AND: [visibilityFilter(student, "targets"), { courseId: null }, STANDALONE_VIDEO, { OR: [{ startDate: null }, { startDate: { lte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
  });

  // Expiration is enforced here (backend), and again at play-time in
  // videoController.streamVideo — never trust a client-side timer alone.
  res.json({ videos: withExpiryFlag(videos) });
}

module.exports = { getMyCourses, getMyCourseDetail, getMyVideos, visibilityFilter, withExpiryFlag };
