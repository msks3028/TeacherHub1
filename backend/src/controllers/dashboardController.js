const prisma = require("../config/db");
const { visibilityFilter, withExpiryFlag } = require("./studentContentController");

// GET /api/teacher/dashboard
async function getTeacherDashboard(req, res) {
  const teacherId = req.user.id;
  const ownedCourseRows = await prisma.course.findMany({ where: { teacherId }, select: { id: true } });
  const ownedCourseIds = ownedCourseRows.map((course) => course.id);
  const studentScope = { ownerTeacherId: teacherId };
  const courseContentScope = ownedCourseIds.length ? [{ courseId: { in: ownedCourseIds } }] : [];
  const lessonScope = { OR: [{ createdById: teacherId }, ...courseContentScope] };
  const homeworkScope = { OR: [{ createdById: teacherId }, ...courseContentScope, { lesson: { is: { createdById: teacherId } } }] };
  const examScope = { OR: [{ createdById: teacherId }, ...courseContentScope] };
  const materialScope = { OR: [{ createdById: teacherId }, ...courseContentScope, { lesson: { is: { createdById: teacherId } } }, { homework: { is: { createdById: teacherId } } }] };
  const videoScope = { OR: [{ createdById: teacherId }, ...courseContentScope] };
  const [
    studentsCount, coursesCount, lessonsCount, videosCount, homeworkCount,
    examsCount, materialsCount, totalVideoViews, recentStudents, recentSubmissions,
    examsAwaitingGrading, homeworkAwaitingGrading,
  ] = await Promise.all([
    prisma.student.count({ where: studentScope }),
    prisma.course.count({ where: { teacherId } }),
    prisma.lesson.count({ where: lessonScope }),
    prisma.video.count({ where: videoScope }),
    prisma.homework.count({ where: homeworkScope }),
    prisma.exam.count({ where: examScope }),
    prisma.material.count({ where: materialScope }),
    prisma.videoView.count({ where: { video: { is: videoScope } } }),
    prisma.student.findMany({ where: studentScope, orderBy: { lastActiveAt: "desc" }, take: 5 }),
    prisma.homeworkSubmission.findMany({
      where: { status: { in: ["SUBMITTED", "LATE"] }, student: { ownerTeacherId: teacherId }, homework: { is: homeworkScope } },
      include: { student: true, homework: true },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    prisma.examAnswer.count({ where: { question: { is: { type: "ESSAY", exam: { is: examScope } } }, pointsAwarded: null } }),
    prisma.homeworkSubmission.count({ where: { status: { in: ["SUBMITTED", "LATE"] }, homework: { is: homeworkScope } } }),
  ]);

  res.json({
    stats: {
      studentsCount, coursesCount, lessonsCount, videosCount, homeworkCount,
      examsCount, materialsCount, totalVideoViews,
      examsAwaitingGrading, homeworkAwaitingGrading,
    },
    recentStudents,
    recentSubmissions,
  });
}

// GET /api/student/dashboard
async function getStudentDashboard(req, res) {
  const student = req.user.studentProfile;
  const now = new Date();

  const enrolledCourseIds = (
    await prisma.courseEnrollment.findMany({ where: { studentId: student.id, course: { status: "PUBLISHED" } }, select: { courseId: true } })
  ).map((e) => e.courseId);

  const [latestVideos, upcomingHomework, availableExams, latestResults, announcements, courses] = await Promise.all([
    prisma.video.findMany({
      where: {
        AND: [visibilityFilter(student, "targets"), { homeworkId: null, lessonId: null }, { OR: [{ courseId: null }, { courseId: { in: enrolledCourseIds } }] }, { OR: [{ startDate: null }, { startDate: { lte: now } }] }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.homework.findMany({
      where: { AND: [visibilityFilter(student, "targets"), { OR: [{ courseId: null }, { courseId: { in: enrolledCourseIds } }] }, { deadline: { gte: now } }] },
      include: { submissions: { where: { studentId: student.id } } },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
    prisma.exam.findMany({
      where: {
        AND: [
          visibilityFilter(student, "targets"),
          { OR: [{ courseId: null }, { courseId: { in: enrolledCourseIds } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      take: 5,
    }),
    prisma.examAttempt.findMany({
      where: { studentId: student.id, status: "GRADED" },
      include: { exam: true },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    prisma.announcement.findMany({
      where: { AND: [
        { OR: [
          { courseId: { in: enrolledCourseIds } },
          { courseId: null, createdById: student.ownerTeacherId || "__no_teacher__" },
        ] },
        { OR: [
          { scope: "ALL_STUDENTS" },
          { scope: "GRADE", grade: student.grade },
          { scope: "GROUP", group: student.group },
          { scope: "SPECIFIC_STUDENTS", targets: { some: { studentId: student.id } } },
        ] },
      ] },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.courseEnrollment.count({ where: { studentId: student.id, course: { status: "PUBLISHED" } } }),
  ]);

  res.json({
    latestVideos: withExpiryFlag(latestVideos),
    upcomingHomework: upcomingHomework.map((h) => ({ ...h, mySubmission: h.submissions[0] || null })),
    availableExams,
    latestResults,
    announcements,
    coursesCount: courses,
  });
}

module.exports = { getTeacherDashboard, getStudentDashboard };
