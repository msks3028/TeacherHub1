const prisma = require("../config/db");
const { visibilityFilter } = require("./studentContentController");
const { notifyStudents, notifyTeacher, resolveTargetStudentIds } = require("../services/notificationService");
const { studentCanSee } = require("../services/accessService");
const { isString, isFiniteNumber, parseDate } = require("../utils/validate");
const { randomUUID } = require("crypto");
const { evaluatePassed, withPassed, hasText } = require("../services/examScoring");
const { teacherContentWhere, teacherOwnsContent, teacherOwnsCourse, teacherOwnsTargets } = require("../services/contentOwnership");

const VISIBILITIES = ["ALL_STUDENTS", "GRADE", "GROUP", "SPECIFIC_STUDENTS"];
const GRACE_MS = 15 * 1000; // network latency allowance on the server-side timer

// The moment an in-progress attempt stops accepting answers: the sooner of
// "started + duration" and the exam's end date. null = no time limit.
// Enforced here on the server — the countdown in the browser is only a display.
function attemptDeadline(attempt, exam) {
  const limits = [];
  if (exam.durationMinutes) limits.push(attempt.startedAt.getTime() + exam.durationMinutes * 60 * 1000);
  if (exam.endDate) limits.push(exam.endDate.getTime());
  return limits.length ? Math.min(...limits) : null;
}
function remainingSeconds(attempt, exam) {
  const deadline = attemptDeadline(attempt, exam);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function targetsData(studentIds) {
  return Array.isArray(studentIds) ? { create: studentIds.map((studentId) => ({ studentId })) } : undefined;
}

// POST /api/teacher/exams
// body: { title, description, courseId, visibility, grade, group, studentIds,
//         startDate, endDate, durationMinutes, maxAttempts, passingScore,
//         questions: [{ type, text, points, options?: [text], correctOptionIndex? }] }
async function createExam(req, res) {
  const {
    title, description, courseId, visibility, grade, group, studentIds,
    startDate, endDate, durationMinutes, maxAttempts, passingScore, questions,
  } = req.body;

  if (!isString(title, { min: 1, max: 200 })) return res.status(400).json({ message: "Exam title is required." });
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200) {
    return res.status(400).json({ message: "At least one question is required." });
  }
  if (description != null && !isString(description, { max: 5000 })) return res.status(400).json({ message: "Invalid description." });
  if (visibility != null && !VISIBILITIES.includes(visibility)) return res.status(400).json({ message: "Invalid visibility." });
  if ((grade != null && !isString(grade, { max: 50 })) || (group != null && !isString(group, { max: 50 })) ||
      (courseId != null && !isString(courseId, { max: 64 }))) {
    return res.status(400).json({ message: "Invalid grade, group or course." });
  }
  if (studentIds != null && !(Array.isArray(studentIds) && studentIds.length <= 5000 && studentIds.every((x) => isString(x, { max: 64 })))) {
    return res.status(400).json({ message: "Invalid students list." });
  }
  const startD = parseDate(startDate);
  const endD = parseDate(endDate);
  if (startD === undefined || endD === undefined) return res.status(400).json({ message: "Invalid date." });
  if (!(await teacherOwnsCourse(req.user.id, courseId)) || !(await teacherOwnsTargets(req.user.id, studentIds))) {
    return res.status(404).json({ message: "Course or student not found." });
  }

  const toInt = (v) => (v === "" || v == null ? null : Number(v));
  const duration = toInt(durationMinutes);
  const attemptsAllowed = toInt(maxAttempts) ?? 1;
  const passing = toInt(passingScore);
  if ((duration !== null && !(Number.isInteger(duration) && duration >= 1 && duration <= 1440)) ||
      !(Number.isInteger(attemptsAllowed) && attemptsAllowed >= 1 && attemptsAllowed <= 50) ||
      (passing !== null && !(isFiniteNumber(passing) && passing >= 0))) {
    return res.status(400).json({ message: "Invalid duration, attempts or passing score." });
  }

  for (const q of questions) {
    const points = q?.points ?? 1;
    const validCommon =
      q && ["MULTIPLE_CHOICE", "ESSAY"].includes(q.type) && isString(q.text, { min: 1, max: 5000 }) &&
      isFiniteNumber(Number(points)) && Number(points) > 0 && Number(points) <= 1000;
    if (!validCommon) return res.status(400).json({ message: "Invalid question." });
    if (q.type === "MULTIPLE_CHOICE") {
      const okOptions = Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 10 &&
        q.options.every((o) => isString(o, { min: 1, max: 1000 }));
      const okCorrect = Number.isInteger(q.correctOptionIndex) && q.correctOptionIndex >= 0 && q.correctOptionIndex < (q.options?.length || 0);
      if (!okOptions || !okCorrect) return res.status(400).json({ message: "Each multiple-choice question needs 2-10 options and a correct answer." });
    }
  }

  // A passing score above the exam's total marks could never be reached — every
  // student would "fail" no matter what they answer.
  const totalPoints = questions.reduce((sum, q) => sum + Number(q.points ?? 1), 0);
  if (passing !== null && passing > totalPoints) {
    return res.status(400).json({ message: `درجة النجاح (${passing}) أكبر من مجموع درجات الاختبار (${totalPoints}).` });
  }

  // Question and option ids are generated HERE so the correct option is written
  // in the same insert. (Creating first and matching options back by array
  // position afterwards depended on the database returning rows in insertion
  // order, which it does not guarantee — a wrong match makes right answers count as wrong.)
  const questionRows = questions.map((q, i) => {
    const options = q.type === "MULTIPLE_CHOICE" ? q.options.map((text, oi) => ({ id: randomUUID(), text, order: oi })) : [];
    return {
      id: randomUUID(),
      type: q.type,
      text: q.text,
      points: Number(q.points ?? 1),
      order: i,
      correctOptionId: q.type === "MULTIPLE_CHOICE" ? options[q.correctOptionIndex].id : null,
      options: options.length ? { create: options } : undefined,
    };
  });

  const exam = await prisma.exam.create({
    data: {
      title, description,
      courseId: courseId || null,
      createdById: req.user.id,
      visibility: visibility || "ALL_STUDENTS", grade, group,
      startDate: startD,
      endDate: endD,
      durationMinutes: duration,
      maxAttempts: attemptsAllowed,
      passingScore: passing,
      targets: targetsData(studentIds),
      questions: { create: questionRows },
    },
  });

  const targetIds = await resolveTargetStudentIds({
    courseId: exam.courseId, visibility: exam.visibility, grade: exam.grade,
    group: exam.group, id: exam.id, targetModel: "examTarget", targetField: "examId", teacherId: req.user.id,
  });
  await notifyStudents(targetIds, {
    type: "EXAM_ADDED", title: "اختبار جديد", body: exam.title, link: `/student/exams/${exam.id}`,
  });

  res.status(201).json({ examId: exam.id });
}

// GET /api/teacher/exams?courseId=
// GET /api/teacher/exams?courseId=
// With no courseId, this is the "general exams" list — course-scoped exams
// must never leak into it (same isolation rule as everywhere else). Manage
// a course's exams from that course's own Exams tab instead.
async function listExams(req, res) {
  const { courseId } = req.query;
  const exams = await prisma.exam.findMany({
    where: { AND: [courseId ? { courseId } : { courseId: null }, teacherContentWhere(req.user.id)] },
    include: { course: { select: { title: true } }, _count: { select: { attempts: true, questions: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ exams });
}

// GET /api/teacher/exams/:examId  (full detail + questions with correct answers, for editing)
async function getExamDetail(req, res) {
  const exam = await prisma.exam.findFirst({
    where: { id: req.params.examId, ...teacherContentWhere(req.user.id) },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  });
  if (!exam) return res.status(404).json({ message: "Exam not found." });
  res.json({ exam });
}

// GET /api/teacher/exams/:examId/analytics
async function getExamAnalytics(req, res) {
  const { examId } = req.params;
  const exam = await prisma.exam.findFirst({ where: { id: examId, ...teacherContentWhere(req.user.id) } });
  if (!exam) return res.status(404).json({ message: "Exam not found." });

  const targetIds = await resolveTargetStudentIds({
    courseId: exam.courseId, visibility: exam.visibility, grade: exam.grade,
    group: exam.group, id: exam.id, targetModel: "examTarget", targetField: "examId", teacherId: req.user.id,
  });

  const attempts = await prisma.examAttempt.findMany({
    where: { examId, status: { in: ["SUBMITTED", "GRADED"] }, student: { ownerTeacherId: req.user.id } },
    include: { student: true },
  });

  // Same rule the student sees (examScoring.withPassed) — never a separate one.
  const results = attempts
    .map((a) => withPassed(a, exam))
    .sort((a, b) => {
      // attempts waiting for the teacher first, then the highest scores
      const aPending = a.status === "SUBMITTED" ? 0 : 1;
      const bPending = b.status === "SUBMITTED" ? 0 : 1;
      return aPending - bPending || (b.score ?? 0) - (a.score ?? 0);
    });

  const scores = results.map((a) => a.score).filter((sc) => sc !== null);
  const decided = results.filter((a) => a.passed !== null);
  const attemptedStudentIds = new Set(attempts.map((a) => a.studentId));

  res.json({
    totalAssigned: targetIds.length,
    completed: attempts.length,
    notAttempted: targetIds.filter((id) => !attemptedStudentIds.has(id)).length,
    averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null,
    passingScore: exam.passingScore,
    passRate: decided.length ? (decided.filter((a) => a.passed).length / decided.length) * 100 : null,
    results: results.map((a) => ({
      attemptId: a.id,
      attemptNumber: a.attemptNumber,
      studentId: a.studentId,
      studentName: a.student.fullName,
      score: a.score,
      maxScore: a.maxScore,
      status: a.status,
      passed: a.passed,
    })),
  });
}

// GET /api/teacher/exams/essays-to-grade -> essay answers a student wrote that still need a score
async function listEssaysToGrade(req, res) {
  const answers = await prisma.examAnswer.findMany({
    where: {
      question: { type: "ESSAY" },
      pointsAwarded: null,
      essayText: { not: null },
      attempt: { is: { status: { in: ["SUBMITTED", "GRADED"] }, student: { ownerTeacherId: req.user.id }, exam: { is: teacherContentWhere(req.user.id) } } },
    },
    include: {
      question: true,
      attempt: { include: { student: true, exam: true } },
    },
  });
  res.json({ answers: answers.filter((a) => hasText(a.essayText)) });
}

// Once every written essay of a submitted attempt has a score, adds everything
// up (multiple-choice points were awarded automatically when the student
// submitted), stores the final score, and tells the student.
//   total    = the points of ALL the attempt's answers
//   maxScore = the marks of ALL the exam's questions (also the ones left blank)
async function finalizeAttemptIfReady(attemptId) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: { include: { questions: true } }, answers: { include: { question: true } } },
  });
  if (!attempt || attempt.status === "IN_PROGRESS") return { attempt, finalized: false };

  const waiting = attempt.answers.some((a) => a.question.type === "ESSAY" && hasText(a.essayText) && a.pointsAwarded === null);
  if (waiting) return { attempt, finalized: false };

  const total = attempt.answers.reduce((sum, a) => sum + (a.pointsAwarded || 0), 0);
  const maxScore = attempt.exam.questions.reduce((sum, q) => sum + q.points, 0);
  const changed = attempt.status !== "GRADED" || attempt.score !== total;

  const updated = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: { score: total, maxScore, passed: evaluatePassed(total, attempt.exam.passingScore), status: "GRADED" },
  });

  if (changed) {
    await notifyStudents([attempt.studentId], {
      type: "EXAM_GRADED",
      title: "ظهرت نتيجة اختبارك",
      body: `${attempt.exam.title}: ${total}/${maxScore}`,
      link: `/student/results`,
    });
  }
  return { attempt: withPassed(updated, attempt.exam), finalized: true };
}

const parsePoints = (raw) => (typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw);

// PATCH /api/teacher/exams/answers/:answerId/grade  { pointsAwarded, teacherFeedback }
async function gradeEssayAnswer(req, res) {
  const { pointsAwarded: rawPoints, teacherFeedback } = req.body || {};
  const pointsAwarded = parsePoints(rawPoints);
  if (!isFiniteNumber(pointsAwarded) || pointsAwarded < 0) {
    return res.status(400).json({ message: "Points must be a valid number." });
  }
  if (teacherFeedback != null && !isString(teacherFeedback, { max: 5000 })) {
    return res.status(400).json({ message: "Invalid feedback." });
  }

  // Points can't exceed the question's value, and an attempt that is still
  // being taken can't be graded (that would finalize it under the student).
  const target = await prisma.examAnswer.findFirst({
    where: { id: req.params.answerId },
    include: { question: true, attempt: { include: { student: true } } },
  });
  if (!target) return res.status(404).json({ message: "Answer not found." });
  if (target.attempt.student.ownerTeacherId !== req.user.id || !(await teacherOwnsContent("exam", target.attempt.examId, req.user.id))) return res.status(404).json({ message: "Answer not found." });
  if (target.attempt.status === "IN_PROGRESS") {
    return res.status(409).json({ message: "The student is still taking this exam." });
  }
  if (target.question.type !== "ESSAY") {
    return res.status(400).json({ message: "Only essay answers are graded by hand." });
  }
  if (pointsAwarded > target.question.points) {
    return res.status(400).json({ message: `Maximum for this question is ${target.question.points}.` });
  }

  const answer = await prisma.examAnswer.update({
    where: { id: target.id },
    data: { pointsAwarded, teacherFeedback },
  });
  const { attempt } = await finalizeAttemptIfReady(target.attemptId);

  res.json({ answer, attempt });
}

// GET /api/teacher/exams/attempts/:attemptId
// Everything the teacher needs to review one student's attempt: every question
// with what the student answered (essay text / chosen option), the right
// answer for multiple choice, and the points awarded so far.
async function getAttemptDetail(req, res) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: req.params.attemptId, student: { ownerTeacherId: req.user.id }, exam: { is: teacherContentWhere(req.user.id) } },
    include: {
      student: true,
      answers: true,
      exam: { include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } },
    },
  });
  if (!attempt) return res.status(404).json({ message: "Attempt not found." });

  const byQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const questions = attempt.exam.questions.map((q) => {
    const a = byQuestion.get(q.id);
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      options: [...q.options].sort((x, y) => x.order - y.order).map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: q.correctOptionId,
      answerId: a?.id ?? null,
      selectedOptionId: a?.selectedOptionId ?? null,
      essayText: a?.essayText ?? null,
      isCorrect: q.type === "MULTIPLE_CHOICE" ? !!a && a.selectedOptionId != null && a.selectedOptionId === q.correctOptionId : null,
      pointsAwarded: a?.pointsAwarded ?? null,
      teacherFeedback: a?.teacherFeedback ?? null,
    };
  });

  const shown = withPassed(attempt, attempt.exam);
  res.json({
    attempt: {
      id: shown.id, status: shown.status, attemptNumber: shown.attemptNumber, submittedAt: shown.submittedAt,
      score: shown.score, maxScore: shown.maxScore, passed: shown.passed, feedback: shown.feedback,
    },
    student: { id: attempt.student.id, fullName: attempt.student.fullName },
    exam: { id: attempt.exam.id, title: attempt.exam.title, passingScore: attempt.exam.passingScore },
    questions,
  });
}

// PATCH /api/teacher/exams/attempts/:attemptId/grade
//   { grades: [{ answerId, pointsAwarded, teacherFeedback? }], feedback? }
// The teacher scores all of a student's essay answers in one go; when none is
// left waiting, the attempt gets its final score and the student is notified.
async function gradeAttempt(req, res) {
  const { grades, feedback } = req.body || {};
  if (!Array.isArray(grades) || grades.length === 0 || grades.length > 500) {
    return res.status(400).json({ message: "No grades were sent." });
  }
  if (feedback != null && !isString(feedback, { max: 5000 })) return res.status(400).json({ message: "Invalid feedback." });

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: req.params.attemptId, student: { ownerTeacherId: req.user.id }, exam: { is: teacherContentWhere(req.user.id) } },
    include: { answers: { include: { question: true } } },
  });
  if (!attempt) return res.status(404).json({ message: "Attempt not found." });
  if (attempt.status === "IN_PROGRESS") return res.status(409).json({ message: "The student is still taking this exam." });

  const answers = new Map(attempt.answers.map((a) => [a.id, a]));
  const updates = [];
  for (const g of grades) {
    const answer = answers.get(g?.answerId);
    const points = parsePoints(g?.pointsAwarded);
    if (!answer || answer.question.type !== "ESSAY") return res.status(400).json({ message: "Invalid answer in the list." });
    if (!isFiniteNumber(points) || points < 0) return res.status(400).json({ message: "Points must be a valid number." });
    if (points > answer.question.points) return res.status(400).json({ message: `Maximum for a question is ${answer.question.points}.` });
    if (g.teacherFeedback != null && !isString(g.teacherFeedback, { max: 5000 })) return res.status(400).json({ message: "Invalid feedback." });
    updates.push(prisma.examAnswer.update({ where: { id: answer.id }, data: { pointsAwarded: points, teacherFeedback: g.teacherFeedback ?? null } }));
  }
  if (feedback !== undefined) updates.push(prisma.examAttempt.update({ where: { id: attempt.id }, data: { feedback: feedback || null } }));
  await prisma.$transaction(updates);

  const result = await finalizeAttemptIfReady(attempt.id);
  res.json({ attempt: result.attempt, finalized: result.finalized });
}

// ---- Student side ----

// GET /api/student/exams
// GET /api/student/exams — ONLY general (non-course) exams. Course exams
// live exclusively inside that course's own page.
async function getMyExams(req, res) {
  const student = req.user.studentProfile;

  const exams = await prisma.exam.findMany({
    where: {
      AND: [visibilityFilter(student, "targets"), { courseId: null }],
    },
    include: { attempts: { where: { studentId: student.id } }, _count: { select: { questions: true } } },
    orderBy: { startDate: "desc" },
  });

  res.json({
    exams: exams.map((e) => ({ ...e, myAttempts: e.attempts.map((a) => withPassed(a, e)), attempts: undefined })),
  });
}

// POST /api/student/exams/:examId/start
async function startAttempt(req, res) {
  const student = req.user.studentProfile;
  const { examId } = req.params;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  });
  // 404 (not 403) when the exam isn't visible to this student — no probing by id.
  if (!exam || !(await studentCanSee("exam", student, exam))) {
    return res.status(404).json({ message: "Exam not found." });
  }

  const now = new Date();
  if (exam.startDate && exam.startDate > now) return res.status(403).json({ message: "لم يبدأ الاختبار بعد." });
  // (After the end date a NEW attempt can't be started, but a student who is
  // already mid-attempt may still resume it to submit what they answered.)
  const windowOpen = !exam.endDate || exam.endDate >= now;

  // Find-or-create the student's attempt inside ONE transaction that is
  // serialized per (exam, student) with a Postgres advisory lock.
  //
  // Why: React 18 StrictMode (dev), double-clicks and page refreshes can fire
  // two /start requests at the same instant. Without the lock both requests
  // pass the "no attempt in progress" check, both try to INSERT the same
  // (examId, studentId, attemptNumber) and the loser hits the unique
  // constraint (Prisma P2002). With the lock the second request waits, then
  // simply finds and resumes the attempt the first request created.
  //
  // The next attemptNumber is also computed from MAX(attemptNumber)+1 rather
  // than COUNT+1, so gaps in the numbering can never cause a collision.
  const lockKey = `exam-attempt:${examId}:${student.id}`;

  async function findOrCreateAttempt() {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const inProgress = await tx.examAttempt.findFirst({
        where: { examId, studentId: student.id, status: "IN_PROGRESS" },
        orderBy: { attemptNumber: "desc" },
      });
      if (inProgress) return { attempt: inProgress };
      if (!windowOpen) return { closed: true };

      const stats = await tx.examAttempt.aggregate({
        where: { examId, studentId: student.id },
        _count: { _all: true },
        _max: { attemptNumber: true },
      });
      if (stats._count._all >= exam.maxAttempts) return { exhausted: true };

      const attempt = await tx.examAttempt.create({
        data: {
          examId,
          studentId: student.id,
          attemptNumber: (stats._max.attemptNumber || 0) + 1,
        },
      });
      return { attempt };
    });
  }

  let result;
  try {
    result = await findOrCreateAttempt();
  } catch (err) {
    // Safety net (e.g. multiple server processes / lock not honoured):
    // if the unique constraint still fires, run the same logic once more —
    // it will now see the attempt that won the race and resume it.
    if (err.code === "P2002") {
      result = await findOrCreateAttempt();
    } else {
      throw err;
    }
  }

  if (result.closed) {
    return res.status(403).json({ message: "انتهى وقت الاختبار." });
  }
  if (result.exhausted) {
    return res.status(403).json({ message: "لقد استنفدت عدد المحاولات المسموح بها." });
  }
  const attempt = result.attempt;

  // Never send correctOptionId to the student.
  const safeQuestions = exam.questions.map((q) => ({
    id: q.id, type: q.type, text: q.text, points: q.points,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));

  res.status(201).json({
    attemptId: attempt.id,
    durationMinutes: exam.durationMinutes,
    // Time left according to the SERVER clock, so refreshing the page can't reset the timer.
    remainingSeconds: remainingSeconds(attempt, exam),
    questions: safeQuestions,
  });
}

// POST /api/student/exams/attempts/:attemptId/answer  { questionId, selectedOptionId?, essayText? }
// Called on every answer change so progress is never lost on a connection drop.
async function saveAnswer(req, res) {
  const { attemptId } = req.params;
  const { questionId, selectedOptionId, essayText } = req.body || {};

  if (!isString(questionId, { min: 1, max: 64 })) return res.status(400).json({ message: "Invalid question." });

  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true } });
  if (!attempt || attempt.studentId !== req.user.studentProfile.id) {
    return res.status(404).json({ message: "Attempt not found." });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return res.status(403).json({ message: "This attempt is already submitted." });
  }

  // Time limit enforced server-side: no answers are accepted after the deadline.
  const deadline = attemptDeadline(attempt, attempt.exam);
  if (deadline !== null && Date.now() > deadline + GRACE_MS) {
    return res.status(403).json({ message: "انتهى وقت الاختبار." });
  }

  // The question must belong to THIS attempt's exam, and the chosen option to that question.
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: { select: { id: true } } },
  });
  if (!question || question.examId !== attempt.examId) {
    return res.status(400).json({ message: "Question does not belong to this exam." });
  }

  let data;
  if (question.type === "MULTIPLE_CHOICE") {
    if (selectedOptionId !== null && selectedOptionId !== undefined &&
        !question.options.some((o) => o.id === selectedOptionId)) {
      return res.status(400).json({ message: "Invalid option." });
    }
    data = { selectedOptionId: selectedOptionId || null, essayText: null };
  } else {
    if (essayText !== null && essayText !== undefined && !isString(essayText, { max: 20000 })) {
      return res.status(400).json({ message: "Answer is too long." });
    }
    data = { essayText: essayText ?? null, selectedOptionId: null };
  }

  const answer = await prisma.examAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: data,
    create: { attemptId, questionId, ...data },
  });

  res.json({ answer });
}

// Stores the answers the browser sends together with "submit", so the score
// never depends on a background save that might still be in flight (or that
// arrived out of order) at the moment the student pressed the button.
async function applyFinalAnswers(attempt, finalAnswers) {
  if (!Array.isArray(finalAnswers) || finalAnswers.length > 500) return;

  const questions = await prisma.question.findMany({
    where: { examId: attempt.examId },
    include: { options: { select: { id: true } } },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  const writes = [];
  for (const item of finalAnswers) {
    const q = byId.get(item?.questionId);
    if (!q) continue; // unknown question: ignore it, never block the submission
    let data;
    if (q.type === "MULTIPLE_CHOICE") {
      const chosen = item.selectedOptionId;
      if (chosen != null && !q.options.some((o) => o.id === chosen)) continue;
      data = { selectedOptionId: chosen || null, essayText: null };
    } else {
      if (item.essayText != null && !isString(item.essayText, { max: 20000 })) continue;
      data = { essayText: item.essayText ?? null, selectedOptionId: null };
    }
    writes.push(prisma.examAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: q.id } },
      update: data,
      create: { attemptId: attempt.id, questionId: q.id, ...data },
    }));
  }
  if (writes.length) await prisma.$transaction(writes);
}

// POST /api/student/exams/attempts/:attemptId/submit   { answers?: [{ questionId, selectedOptionId?, essayText? }] }
async function submitAttempt(req, res) {
  const { attemptId } = req.params;

  const owned = await prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true } });
  if (!owned || owned.studentId !== req.user.studentProfile.id) {
    return res.status(404).json({ message: "Attempt not found." });
  }

  if (owned.status === "IN_PROGRESS") {
    const deadline = attemptDeadline(owned, owned.exam);
    if (deadline === null || Date.now() <= deadline + GRACE_MS) {
      await applyFinalAnswers(owned, req.body?.answers);
    }
  }

  // Atomically claim the submission. Two simultaneous submits (double click,
  // auto-submit + manual click) can't both pass: only one flips the status,
  // so the score is computed and the notifications are sent exactly once.
  const claimed = await prisma.examAttempt.updateMany({
    where: { id: attemptId, status: "IN_PROGRESS" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (claimed.count === 0) return res.json({ message: "Already submitted." });

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: { include: { questions: true } },
      answers: { include: { question: true } },
    },
  });

  // Multiple choice is marked right now. A written essay waits for the teacher;
  // an essay left blank is simply 0 (there is nothing to read).
  let autoScore = 0;
  let needsTeacher = false;
  const writes = [];
  for (const answer of attempt.answers) {
    if (answer.question.type === "MULTIPLE_CHOICE") {
      const isCorrect = answer.selectedOptionId != null && answer.selectedOptionId === answer.question.correctOptionId;
      const pointsAwarded = isCorrect ? answer.question.points : 0;
      autoScore += pointsAwarded;
      writes.push(prisma.examAnswer.update({ where: { id: answer.id }, data: { isCorrect, pointsAwarded } }));
    } else if (hasText(answer.essayText)) {
      needsTeacher = true;
    } else {
      writes.push(prisma.examAnswer.update({ where: { id: answer.id }, data: { pointsAwarded: 0 } }));
    }
  }

  const maxScore = attempt.exam.questions.reduce((sum, q) => sum + q.points, 0);
  writes.push(prisma.examAttempt.update({
    where: { id: attemptId },
    data: needsTeacher
      ? { status: "SUBMITTED", submittedAt: new Date(), score: null, maxScore, passed: null }
      : { status: "GRADED", submittedAt: new Date(), score: autoScore, maxScore, passed: evaluatePassed(autoScore, attempt.exam.passingScore) },
  }));
  const results = await prisma.$transaction(writes);
  const updated = results[results.length - 1];

  if (needsTeacher) {
    const teacherId = attempt.exam.createdById || (attempt.exam.courseId
      ? (await prisma.course.findUnique({ where: { id: attempt.exam.courseId }, select: { teacherId: true } }))?.teacherId
      : null);
    if (teacherId) {
      await notifyTeacher(teacherId, {
        type: "NEEDS_GRADING",
        title: "اختبار يحتاج تصحيح يدوي",
        body: attempt.exam.title,
        link: `/teacher/exams`,
      });
    }
  } else {
    await notifyStudents([attempt.studentId], {
      type: "EXAM_GRADED",
      title: "ظهرت نتيجة اختبارك",
      body: `${attempt.exam.title}: ${autoScore}/${maxScore}`,
      link: `/student/results`,
    });
  }

  res.json({ attempt: withPassed(updated, attempt.exam), needsGrading: needsTeacher });
}

// GET /api/student/results
async function getMyResults(req, res) {
  const student = req.user.studentProfile;
  const attempts = await prisma.examAttempt.findMany({
    where: { studentId: student.id, status: "GRADED" },
    include: { exam: true },
    orderBy: { submittedAt: "desc" },
  });
  res.json({ results: attempts.map((a) => withPassed(a, a.exam)) });
}

module.exports = {
  createExam, listExams, getExamDetail, getExamAnalytics, listEssaysToGrade, gradeEssayAnswer,
  getAttemptDetail, gradeAttempt,
  getMyExams, startAttempt, saveAnswer, submitAttempt, getMyResults,
};
