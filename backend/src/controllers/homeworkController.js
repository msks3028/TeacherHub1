const prisma = require("../config/db");
const { visibilityFilter, withExpiryFlag } = require("./studentContentController");
const { notifyStudents, notifyTeacher, resolveTargetStudentIds } = require("../services/notificationService");
const { studentCanSee } = require("../services/accessService");
const { teacherContentWhere, teacherOwnsContent, teacherOwnsCourse, teacherOwnsLesson, teacherOwnsTargets } = require("../services/contentOwnership");
const { isString, isUploadUrl, isSafeHttpUrl, isFiniteNumber, parseDate } = require("../utils/validate");

function targetsData(studentIds) {
  return Array.isArray(studentIds) ? { create: studentIds.map((studentId) => ({ studentId })) } : undefined;
}

// POST /api/teacher/homework
async function createHomework(req, res) {
  const {
    title, description, deadline, allowLateSubmission,
    courseId, lessonId, visibility, grade, group, studentIds,
  } = req.body;

  if (!isString(title, { min: 1, max: 200 })) return res.status(400).json({ message: "Homework title is required." });
  if (description !== undefined && description !== null && !isString(description, { max: 10000 })) {
    return res.status(400).json({ message: "Invalid description." });
  }
  const deadlineDate = parseDate(deadline);
  if (deadlineDate === undefined) return res.status(400).json({ message: "Invalid deadline." });
  if (!(await teacherOwnsCourse(req.user.id, courseId)) || !(await teacherOwnsLesson(req.user.id, lessonId, courseId)) ||
      !(await teacherOwnsTargets(req.user.id, studentIds))) {
    return res.status(404).json({ message: "Course, lesson or student not found." });
  }

  const homework = await prisma.homework.create({
    data: {
      title,
      description,
      deadline: deadlineDate,
      allowLateSubmission: !!allowLateSubmission,
      courseId: courseId || null,
      lessonId: lessonId || null,
      createdById: req.user.id,
      visibility: visibility || "ALL_STUDENTS",
      grade,
      group,
      targets: targetsData(studentIds),
    },
  });

  const targetIds = await resolveTargetStudentIds({
    courseId: homework.courseId, visibility: homework.visibility, grade: homework.grade,
    group: homework.group, id: homework.id, targetModel: "homeworkTarget", targetField: "homeworkId", teacherId: req.user.id,
  });
  await notifyStudents(targetIds, {
    type: "HOMEWORK_ADDED", title: "واجب جديد", body: homework.title, link: `/student/homework/${homework.id}`,
  });

  res.status(201).json({ homework });
}

// GET /api/teacher/homework?courseId=
// GET /api/teacher/homework?courseId=
// With no courseId, this is the "general homework" list — course-scoped
// homework must never leak into it (same isolation rule as videos).
async function listHomework(req, res) {
  const { courseId } = req.query;
  const homework = await prisma.homework.findMany({
    where: { AND: [courseId ? { courseId } : { courseId: null }, teacherContentWhere(req.user.id)] },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ homework });
}

// GET /api/teacher/homework/:homeworkId  (with all submissions for review)
async function getHomeworkDetail(req, res) {
  const homework = await prisma.homework.findFirst({
    where: { id: req.params.homeworkId, ...teacherContentWhere(req.user.id) },
    include: {
      submissions: { where: { student: { ownerTeacherId: req.user.id } }, include: { student: true } },
      explanationVideos: true,
      materials: true,
    },
  });
  if (!homework) return res.status(404).json({ message: "Homework not found." });
  res.json({ homework });
}

// PUT /api/teacher/homework/:homeworkId
async function updateHomework(req, res) {
  const { title, description, deadline, allowLateSubmission } = req.body;
  if (!(await teacherOwnsContent("homework", req.params.homeworkId, req.user.id))) return res.status(404).json({ message: "Homework not found." });
  const homework = await prisma.homework.update({
    where: { id: req.params.homeworkId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
      ...(allowLateSubmission !== undefined ? { allowLateSubmission: !!allowLateSubmission } : {}),
    },
  });
  res.json({ homework });
}

// DELETE /api/teacher/homework/:homeworkId
async function deleteHomework(req, res) {
  if (!(await teacherOwnsContent("homework", req.params.homeworkId, req.user.id))) return res.status(404).json({ message: "Homework not found." });
  await prisma.homework.delete({ where: { id: req.params.homeworkId } });
  res.json({ message: "Homework deleted." });
}

// PATCH /api/teacher/homework/submissions/:submissionId/grade  { grade, feedback }
async function gradeSubmission(req, res) {
  const { grade: rawGrade, feedback } = req.body || {};
  const grade = typeof rawGrade === "string" && rawGrade.trim() !== "" ? Number(rawGrade) : rawGrade;
  if (!isFiniteNumber(grade) || grade < 0 || grade > 100000) {
    return res.status(400).json({ message: "Grade must be a valid number." });
  }
  if (feedback !== undefined && feedback !== null && !isString(feedback, { max: 5000 })) {
    return res.status(400).json({ message: "Invalid feedback." });
  }

  const owned = await prisma.homeworkSubmission.findFirst({
    where: { id: req.params.submissionId, student: { ownerTeacherId: req.user.id }, homework: { is: teacherContentWhere(req.user.id) } },
    select: { id: true },
  });
  if (!owned) return res.status(404).json({ message: "Submission not found." });
  const submission = await prisma.homeworkSubmission.update({
    where: { id: req.params.submissionId },
    data: { grade, feedback, status: "GRADED", gradedAt: new Date() },
    include: { student: true, homework: true },
  });

  await notifyStudents([submission.studentId], {
    type: "HOMEWORK_GRADED",
    title: "تم تصحيح واجبك",
    body: `${submission.homework.title}: ${grade}`,
    link: `/student/homework/${submission.homeworkId}`,
  });

  res.json({ submission });
}

// ---- Student side ----

// GET /api/student/homework
// GET /api/student/homework — ONLY general (non-course) homework. Course
// homework lives exclusively inside that course's own page.
async function getMyHomework(req, res) {
  const student = req.user.studentProfile;

  const homework = await prisma.homework.findMany({
    where: {
      AND: [visibilityFilter(student, "targets"), { courseId: null, lessonId: null }],
    },
    include: {
      submissions: { where: { studentId: student.id } },
      explanationVideos: true,
      materials: { where: visibilityFilter(student, "targets", { requirePublished: false }) },
    },
    orderBy: { deadline: "asc" },
  });

  res.json({
    homework: homework.map((h) => ({
      ...h,
      mySubmission: h.submissions[0] || null,
      submissions: undefined,
      explanationVideos: withExpiryFlag(h.explanationVideos),
    })),
  });
}

// POST /api/student/homework/:homeworkId/submit  { answerText, fileUrls }
async function submitHomework(req, res) {
  const student = req.user.studentProfile;
  const { homeworkId } = req.params;
  const { answerText, fileUrls } = req.body || {};

  const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
  // 404 (not 403) when the student may not see it — same as "doesn't exist".
  if (!homework || !(await studentCanSee("homework", student, homework))) {
    return res.status(404).json({ message: "Homework not found." });
  }

  // --- input validation ---
  if (answerText !== undefined && answerText !== null && !isString(answerText, { max: 10000 })) {
    return res.status(400).json({ message: "Answer is too long or invalid." });
  }
  // File URLs must be files produced by OUR submission upload endpoint. A
  // free-form string here (e.g. "javascript:...") would later be shown to the
  // teacher as a link.
  const files = fileUrls === undefined || fileUrls === null ? [] : fileUrls;
  if (!Array.isArray(files) || files.length > 5 || !files.every((u) => isUploadUrl("submission", u))) {
    return res.status(400).json({ message: "Invalid attachment." });
  }
  if (!(answerText && answerText.trim()) && files.length === 0) {
    return res.status(400).json({ message: "اكتب إجابة أو أرفق ملفًا." });
  }

  const now = new Date();
  const isLate = !!(homework.deadline && homework.deadline < now);

  if (isLate && !homework.allowLateSubmission) {
    return res.status(403).json({ message: "لقد انتهى موعد تسليم هذا الواجب." });
  }

  // A graded submission is final — otherwise a student could change the
  // answer after receiving a grade and keep the old grade.
  const existing = await prisma.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
  });
  if (existing && existing.status === "GRADED") {
    return res.status(403).json({ message: "تم تصحيح هذا الواجب ولا يمكن تعديل التسليم." });
  }

  const submission = await prisma.homeworkSubmission.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
    update: {
      answerText, fileUrls: files,
      status: isLate ? "LATE" : "SUBMITTED", isLate, submittedAt: now,
    },
    create: {
      homeworkId, studentId: student.id, answerText, fileUrls: files,
      status: isLate ? "LATE" : "SUBMITTED", isLate, submittedAt: now,
    },
  });

  const teacher = await prisma.homework.findUnique({ where: { id: homeworkId }, select: { createdById: true, course: { select: { teacherId: true } } } });
  const teacherId = teacher?.createdById || teacher?.course?.teacherId;
  if (teacherId) {
    await notifyTeacher(teacherId, {
      type: "HOMEWORK_SUBMITTED",
      title: "تسليم واجب جديد",
      body: `${student.fullName} سلّم ${homework.title}`,
      link: `/teacher/homework/${homeworkId}`,
    });
  }

  res.status(201).json({ submission });
}

// POST /api/teacher/homework/:homeworkId/video  { title, fileUrl, thumbnailUrl?, description?, expirationDate? }
// Attaches an explanation video to a homework item — same isolation rule as
// everything else: this video is scoped to this homework (and its course,
// if any), never shown as a "general" video. Students who can see the homework
// can watch it; the teacher can play it too (see getAccessibleVideo).
async function addVideoToHomework(req, res) {
  const { homeworkId } = req.params;
  const { title, description, fileUrl, thumbnailUrl, expirationDate } = req.body || {};
  if (!isString(title, { min: 1, max: 200 }) || !isUploadUrl("video", fileUrl)) {
    return res.status(400).json({ message: "العنوان وملف الفيديو مطلوبان." });
  }
  if (description != null && !isString(description, { max: 5000 })) {
    return res.status(400).json({ message: "Invalid description." });
  }
  if (thumbnailUrl != null && thumbnailUrl !== "" && !(isSafeHttpUrl(thumbnailUrl) || isUploadUrl("image", thumbnailUrl))) {
    return res.status(400).json({ message: "Invalid thumbnail." });
  }
  const expiry = parseDate(expirationDate);
  if (expiry === undefined) return res.status(400).json({ message: "Invalid expiration date." });

  const homework = await prisma.homework.findFirst({ where: { id: homeworkId, ...teacherContentWhere(req.user.id) } });
  if (!homework) return res.status(404).json({ message: "Homework not found." });

  // For "specific students" homework, the video is aimed at the same students.
  let targets;
  if (homework.visibility === "SPECIFIC_STUDENTS") {
    const rows = await prisma.homeworkTarget.findMany({ where: { homeworkId: homework.id }, select: { studentId: true } });
    targets = { create: rows.map((r) => ({ studentId: r.studentId })) };
  }

  const video = await prisma.video.create({
    data: {
      title,
      description,
      fileUrl,
      thumbnailUrl: thumbnailUrl || undefined,
      homeworkId: homework.id,
      courseId: homework.courseId,
      visibility: homework.visibility,
      grade: homework.grade,
      group: homework.group,
      expirationDate: expiry,
      targets,
      createdById: req.user.id,
    },
  });

  // Let the students know there is a new explanation video for this homework.
  const targetIds = await resolveTargetStudentIds({
    courseId: homework.courseId, visibility: homework.visibility, grade: homework.grade,
    group: homework.group, id: homework.id, targetModel: "homeworkTarget", targetField: "homeworkId", teacherId: req.user.id,
  });
  await notifyStudents(targetIds, {
    type: "VIDEO_ADDED", title: "فيديو شرح جديد للواجب", body: homework.title, link: `/student/homework/${homework.id}`,
  });

  res.status(201).json({ video });
}

module.exports = {
  createHomework, listHomework, getHomeworkDetail, updateHomework, deleteHomework,
  gradeSubmission, getMyHomework, submitHomework, addVideoToHomework,
};
