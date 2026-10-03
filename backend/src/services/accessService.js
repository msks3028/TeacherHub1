const prisma = require("../config/db");

// One place that answers "may THIS user see THIS piece of content?".
// Used by file streaming, comments, exams and homework so the rule can never
// drift between endpoints (a forgotten check in one of them is an IDOR).

async function isStudentEnrolledInCourse(studentId, courseId) {
  if (!courseId) return true; // general content has no course gate
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
    include: { course: { select: { status: true } } },
  });
  return enrollment?.course?.status === "PUBLISHED";
}

// `row` is a Video/Homework/Material/Exam record plus:
//   __targetModel  (prisma model name of the *Target join table)
//   __targetField  (its foreign-key field name)
async function studentCanSeeRow(student, row) {
  if (row.status && row.status !== "PUBLISHED") return false;
  if (row.courseId && !(await isStudentEnrolledInCourse(student.id, row.courseId))) return false;
  // General content must remain within the teacher who owns this student's
  // account. Course content is scoped by enrollment above.
  if (!row.courseId && (!student.ownerTeacherId || row.createdById !== student.ownerTeacherId)) return false;
  if (row.visibility === "ALL_STUDENTS") return true;
  if (row.visibility === "GRADE") return row.grade === student.grade;
  if (row.visibility === "GROUP") return !!row.group && row.group === student.group;
  if (row.visibility === "SPECIFIC_STUDENTS") {
    const target = await prisma[row.__targetModel].findFirst({
      where: { [row.__targetField]: row.id, studentId: student.id },
    });
    return !!target;
  }
  return false;
}

const TARGETS = {
  video: { __targetModel: "videoTarget", __targetField: "videoId" },
  homework: { __targetModel: "homeworkTarget", __targetField: "homeworkId" },
  material: { __targetModel: "materialTarget", __targetField: "materialId" },
  exam: { __targetModel: "examTarget", __targetField: "examId" },
  lesson: { __targetModel: "lessonTarget", __targetField: "lessonId" },
};

async function studentCanSeeParent(kind, student, row, relationField) {
  const parentId = row[relationField];
  if (!parentId) return true;

  const modelName = relationField === "lessonId" ? "lesson" : "homework";
  const parent = await prisma[modelName].findUnique({ where: { id: parentId } });
  if (!parent) return false;
  if (row.courseId && parent.courseId && row.courseId !== parent.courseId) return false;
  return studentCanSee(kind, student, parent);
}

async function studentCanSee(kind, student, row) {
  if (!(await studentCanSeeRow(student, { ...row, ...TARGETS[kind] }))) return false;

  // Nested content inherits the parent's access rules. Otherwise a student
  // could fetch a material, homework, or lesson video directly by ID even
  // when the parent lesson/homework is assigned to a different student.
  if (kind === "homework" && !(await studentCanSeeParent("lesson", student, row, "lessonId"))) return false;
  if (kind === "video" && !row.homeworkId && !(await studentCanSeeParent("lesson", student, row, "lessonId"))) return false;
  if (kind === "material") {
    if (!(await studentCanSeeParent("lesson", student, row, "lessonId"))) return false;
    if (!(await studentCanSeeParent("homework", student, row, "homeworkId"))) return false;
  }
  return true;
}

// Returns { video } when `user` may access the video right now,
// or { error: { status, message } } otherwise.
async function getAccessibleVideo(user, videoId) {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return { error: { status: 404, message: "Video not found." } };

  // The teacher may always play their own platform's videos (to preview them
  // right after uploading, before the start date, or after expiry). Only
  // students are held to the availability window and to the visibility rules.
  if (user.role === "TEACHER") {
    const ownsVideo = video.createdById === user.id;
    let ownsParent = false;
    if (video.courseId) {
      ownsParent = !!(await prisma.course.findFirst({ where: { id: video.courseId, teacherId: user.id }, select: { id: true } }));
    }
    if (video.homeworkId) {
      const homework = await prisma.homework.findFirst({
        where: { id: video.homeworkId, OR: [{ createdById: user.id }, { course: { is: { teacherId: user.id } } }] },
        select: { id: true },
      });
      ownsParent ||= !!homework;
    }
    if (video.lessonId) {
      const lesson = await prisma.lesson.findFirst({
        where: { id: video.lessonId, OR: [{ createdById: user.id }, { course: { is: { teacherId: user.id } } }] },
        select: { id: true },
      });
      ownsParent ||= !!lesson;
    }
    return ownsVideo || ownsParent
      ? { video }
      : { error: { status: 404, message: "Video not found." } };
  }

  const now = new Date();
  if (video.expirationDate && video.expirationDate < now) {
    return { error: { status: 410, message: "This video has expired and is no longer available." } };
  }
  if (video.startDate && video.startDate > now) {
    return { error: { status: 403, message: "This video is not available yet." } };
  }

  const student = user.studentProfile;
  if (!student) return { error: { status: 403, message: "You do not have access to this video." } };

  // An explanation video attached to a homework is visible to exactly the
  // students who can see that homework (including "specific students" homework,
  // which has no per-video target list of its own).
  let allowed;
  if (video.homeworkId) {
    const homework = await prisma.homework.findUnique({ where: { id: video.homeworkId } });
    allowed = !!homework && (await studentCanSee("homework", student, homework));
    if (allowed && video.lessonId) allowed = await studentCanSeeParent("lesson", student, video, "lessonId");
  } else {
    allowed = await studentCanSee("video", student, video);
  }
  if (!allowed) return { error: { status: 403, message: "You do not have access to this video." } };

  return { video };
}

module.exports = { isStudentEnrolledInCourse, studentCanSeeRow, studentCanSee, getAccessibleVideo };
