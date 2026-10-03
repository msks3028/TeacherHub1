const prisma = require("../config/db");
const { isString } = require("../utils/validate");
const { parseAnalyticsDateRange, ERROR_MESSAGES } = require("../utils/analyticsDateRange");

function dayKey(date) { return new Date(date).toISOString().slice(0, 10); }
function average(numbers) { return numbers.length ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2)) : null; }

async function getTeacherAnalytics(req, res) {
  const parsedRange = parseAnalyticsDateRange(req.query);
  if (!parsedRange.valid) return res.status(400).json({ message: ERROR_MESSAGES[parsedRange.reason] });
  const range = { from: parsedRange.from, to: parsedRange.to };
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : "";
  if (courseId && !isString(courseId, { min: 1, max: 64 })) return res.status(400).json({ message: "معرّف الكورس غير صالح." });

  const ownedCourses = await prisma.course.findMany({
    where: { teacherId: req.user.id, ...(courseId ? { id: courseId } : {}) },
    select: { id: true, title: true, enrollments: { where: { student: { ownerTeacherId: req.user.id } }, select: { studentId: true } }, _count: { select: { units: true, lessons: true, exams: true, homework: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (courseId && !ownedCourses.length) return res.status(404).json({ message: "الكورس غير موجود." });
  const courseIds = ownedCourses.map((course) => course.id);
  const courseIdSet = new Set(courseIds);
  const courseScope = courseId ? { courseId } : { courseId: { in: courseIds } };
  const rangeDate = { gte: range.from, lte: range.to };

  const studentWhere = courseId
    ? { ownerTeacherId: req.user.id, enrollments: { some: { courseId } } }
    : { ownerTeacherId: req.user.id };

  const [students, lessons, videos, viewEvents, lessonEvents, examAttempts, homeworkSubmissions, attendanceEvents] = await Promise.all([
    prisma.student.findMany({ where: studentWhere, select: { id: true, fullName: true, grade: true, group: true, lastActiveAt: true, enrollments: { where: { courseId: { in: courseIds } }, select: { courseId: true } } } }),
    prisma.lesson.findMany({ where: { ...(courseId ? { courseId } : { OR: [{ createdById: req.user.id }, { courseId: { in: courseIds } }] }) }, select: { id: true, courseId: true, title: true } }),
    prisma.video.findMany({ where: { ...(courseId ? courseScope : { OR: [{ createdById: req.user.id }, { courseId: { in: courseIds } }] }) }, select: { id: true, courseId: true, title: true } }),
    prisma.videoView.findMany({ where: { lastWatchedAt: rangeDate, video: { is: courseId ? { courseId } : { OR: [{ createdById: req.user.id }, { courseId: { in: courseIds } }] } } }, select: { studentId: true, lastWatchedAt: true, completed: true, progressSeconds: true, video: { select: { courseId: true } } } }),
    prisma.lessonProgress.findMany({ where: { updatedAt: rangeDate, lesson: { is: courseId ? { courseId } : { OR: [{ createdById: req.user.id }, { courseId: { in: courseIds } }] } } }, select: { studentId: true, completedAt: true, updatedAt: true, lesson: { select: { courseId: true } } } }),
    prisma.examAttempt.findMany({ where: { submittedAt: rangeDate, status: { in: ["SUBMITTED", "GRADED"] }, exam: { is: courseId ? { courseId } : { OR: [{ createdById: req.user.id }, { courseId: { in: courseIds } }] } } }, select: { studentId: true, submittedAt: true, status: true, score: true, maxScore: true, exam: { select: { id: true, title: true, courseId: true } } } }),
    prisma.homeworkSubmission.findMany({ where: { submittedAt: rangeDate, homework: { is: courseId ? { courseId } : { OR: [{ createdById: req.user.id }, { courseId: { in: courseIds } }, { lesson: { is: { createdById: req.user.id } } }] } } }, select: { studentId: true, submittedAt: true, status: true, grade: true, homework: { select: { id: true, courseId: true } } } }),
    prisma.liveClassAttendance.findMany({ where: { verifiedAt: { not: null }, joinedAt: rangeDate, liveClass: { is: { teacherId: req.user.id, ...(courseId ? { courseId } : {}) } } }, select: { studentId: true, joinedAt: true, durationSeconds: true, liveClass: { select: { courseId: true } } } }),
  ]);

  const studentIds = new Set(students.map((student) => student.id));
  const isStudent = (id) => studentIds.has(id);
  const filteredViews = viewEvents.filter((event) => isStudent(event.studentId));
  const filteredLessons = lessonEvents.filter((event) => isStudent(event.studentId));
  const filteredExams = examAttempts.filter((event) => isStudent(event.studentId));
  const filteredHomework = homeworkSubmissions.filter((event) => isStudent(event.studentId));
  const filteredAttendance = attendanceEvents.filter((event) => isStudent(event.studentId));

  const activeStudentIds = new Set([
    ...filteredViews.map((event) => event.studentId),
    ...filteredLessons.map((event) => event.studentId),
    ...filteredExams.map((event) => event.studentId),
    ...filteredHomework.map((event) => event.studentId),
    ...filteredAttendance.map((event) => event.studentId),
  ]);
  const submissionsGraded = filteredHomework.filter((event) => event.grade !== null);
  const gradedExams = filteredExams.filter((event) => event.status === "GRADED" && event.score !== null);
  const averageExamPercent = average(gradedExams.filter((event) => event.maxScore > 0).map((event) => (event.score / event.maxScore) * 100));
  const averageHomeworkGrade = average(submissionsGraded.map((event) => event.grade));
  const completedVideoViews = filteredViews.filter((event) => event.completed).length;
  const completedLessonEvents = filteredLessons.filter((event) => event.completedAt);
  const completedLessons = completedLessonEvents.length;

  const trendMap = new Map();
  const addEvent = (date, studentId) => {
    const key = dayKey(date);
    const bucket = trendMap.get(key) || { date: key, activities: 0, students: new Set() };
    bucket.activities += 1;
    if (isStudent(studentId)) bucket.students.add(studentId);
    trendMap.set(key, bucket);
  };
  for (const event of filteredViews) addEvent(event.lastWatchedAt, event.studentId);
  for (const event of filteredLessons) addEvent(event.updatedAt, event.studentId);
  for (const event of filteredExams) if (event.submittedAt) addEvent(event.submittedAt, event.studentId);
  for (const event of filteredHomework) if (event.submittedAt) addEvent(event.submittedAt, event.studentId);
  for (const event of filteredAttendance) addEvent(event.joinedAt, event.studentId);
  const trends = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((bucket) => ({ date: bucket.date, activities: bucket.activities, activeStudents: bucket.students.size }));

  const studentActivitySet = activeStudentIds;
  const attentionStudents = students.filter((student) => !studentActivitySet.has(student.id)).sort((a, b) => (a.lastActiveAt?.getTime() || 0) - (b.lastActiveAt?.getTime() || 0)).slice(0, 25).map((student) => ({ id: student.id, fullName: student.fullName, grade: student.grade, group: student.group, lastActiveAt: student.lastActiveAt }));

  const groupByStudent = (events) => events.reduce((map, event) => {
    const rows = map.get(event.studentId) || [];
    rows.push(event);
    map.set(event.studentId, rows);
    return map;
  }, new Map());
  const viewsByStudent = groupByStudent(filteredViews);
  const lessonsByStudent = groupByStudent(filteredLessons);
  const examsByStudent = groupByStudent(filteredExams);
  const homeworkByStudent = groupByStudent(filteredHomework);
  const attendanceByStudent = groupByStudent(filteredAttendance);

  const perStudent = students.map((student) => {
    const views = viewsByStudent.get(student.id) || [];
    const lessonProgress = lessonsByStudent.get(student.id) || [];
    const exams = examsByStudent.get(student.id) || [];
    const homework = homeworkByStudent.get(student.id) || [];
    const attendance = attendanceByStudent.get(student.id) || [];
    const scores = exams.filter((event) => event.status === "GRADED" && event.score !== null && event.maxScore > 0).map((event) => (event.score / event.maxScore) * 100);
    const grades = homework.filter((event) => event.grade !== null).map((event) => event.grade);
    return {
      id: student.id, fullName: student.fullName, grade: student.grade, group: student.group,
      courses: student.enrollments.length, activeInRange: activeStudentIds.has(student.id), lastActiveAt: student.lastActiveAt,
      lessonCompletions: lessonProgress.filter((event) => event.completedAt).length,
      examAttempts: exams.length, averageExamPercent: average(scores),
      homeworkSubmissions: homework.length, averageHomeworkGrade: average(grades),
      videoViews: views.length, attendedSessions: attendance.length,
      attendanceMinutes: Math.round(attendance.reduce((sum, event) => sum + event.durationSeconds, 0) / 60),
    };
  }).sort((a, b) => Number(b.activeInRange) - Number(a.activeInRange) || a.fullName.localeCompare(b.fullName, "ar"));

  const byCourse = ownedCourses.map((course) => {
    const inCourse = (event) => event.courseId === course.id;
    const courseViews = filteredViews.filter((event) => inCourse(event.video));
    const courseLessonProgress = filteredLessons.filter((event) => inCourse(event.lesson));
    const courseLessons = courseLessonProgress.filter((event) => event.completedAt);
    const courseExams = filteredExams.filter((event) => inCourse(event.exam));
    const courseHomework = filteredHomework.filter((event) => inCourse(event.homework));
    const courseAttendance = filteredAttendance.filter((event) => inCourse(event.liveClass));
    const engaged = new Set([...courseViews, ...courseLessonProgress, ...courseExams, ...courseHomework, ...courseAttendance].map((event) => event.studentId));
    const scores = courseExams.filter((event) => event.status === "GRADED" && event.score !== null && event.maxScore > 0).map((event) => (event.score / event.maxScore) * 100);
    const homeworkGrades = courseHomework.filter((event) => event.grade !== null).map((event) => event.grade);
    return {
      courseId: course.id, title: course.title, students: course.enrollments.length,
      lessons: course._count.lessons, exams: course._count.exams, homework: course._count.homework,
      activeStudents: engaged.size, videoViews: courseViews.length,
      lessonCompletions: courseLessons.length, examAttempts: courseExams.length,
      averageExamPercent: average(scores), homeworkSubmissions: courseHomework.length,
      averageHomeworkGrade: average(homeworkGrades), attendanceJoins: courseAttendance.length,
    };
  });

  res.set("Cache-Control", "no-store").json({
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    filters: { courseId: courseId || null },
    metrics: {
      students: students.length,
      activeStudents: activeStudentIds.size,
      studentsNeedingAttention: students.filter((student) => !activeStudentIds.has(student.id)).length,
      videoViews: filteredViews.length,
      completedVideoViews,
      lessonCompletions: completedLessons,
      completionRate: filteredLessons.length ? Number((completedLessons / filteredLessons.length * 100).toFixed(1)) : null,
      examAttempts: filteredExams.length,
      averageExamPercent,
      homeworkSubmissions: filteredHomework.length,
      averageHomeworkGrade,
      attendanceJoins: filteredAttendance.length,
      studentsAttended: new Set(filteredAttendance.map((event) => event.studentId)).size,
      activityCount: filteredViews.length + filteredLessons.length + filteredExams.length + filteredHomework.length + filteredAttendance.length,
    },
    trends,
    courses: byCourse,
    students: perStudent,
    studentsNeedingAttention: attentionStudents,
  });
}

module.exports = { getTeacherAnalytics };
