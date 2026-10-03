const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../config/db");
const { generateStudentQrCode } = require("../utils/qrcode");
const { isString, isEmail, str } = require("../utils/validate");
const { parsePagination, buildMeta } = require("../utils/pagination");

function serializeStudent(student) {
  return {
    id: student.id,
    fullName: student.fullName,
    email: student.user.email,
    grade: student.grade,
    group: student.group,
    isActive: student.user.isActive,
    avatarUrl: student.avatarUrl,
    qrCodeUrl: student.qrCodeUrl,
    lastActiveAt: student.lastActiveAt,
    createdAt: student.createdAt,
  };
}

// GET /api/teacher/students?search=&grade=&group=&page=&limit=
async function listStudents(req, res) {
  // Query values are only ever used as plain strings (never as Prisma filter objects).
  const search = str(req.query.search, 100);
  const grade = str(req.query.grade, 50);
  const group = str(req.query.group, 50);
  const { page, limit, skip } = parsePagination(req.query);

  const where = {
    ownerTeacherId: req.user.id,
    ...(grade ? { grade } : {}),
    ...(group ? { group } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);

  res.json({ students: students.map(serializeStudent), pagination: buildMeta(page, limit, total) });
}

// GET /api/teacher/students/:studentId
async function getStudent(req, res) {
  const student = await prisma.student.findFirst({
    where: { id: req.params.studentId, ownerTeacherId: req.user.id },
    include: {
      user: true,
      enrollments: { where: { course: { teacherId: req.user.id } }, include: { course: true } },
      homeworkSubmissions: { where: { homework: { OR: [{ createdById: req.user.id }, { course: { teacherId: req.user.id } }, { lesson: { createdBy: { id: req.user.id } } }] } }, include: { homework: true } },
      examAttempts: { where: { exam: { OR: [{ createdById: req.user.id }, { course: { teacherId: req.user.id } }] } }, include: { exam: true } },
      videoViews: { where: { video: { OR: [{ createdById: req.user.id }, { course: { teacherId: req.user.id } }] } }, include: { video: true } },
    },
  });

  if (!student) return res.status(404).json({ message: "Student not found." });

  res.json({
    student: serializeStudent(student),
    courses: student.enrollments.map((e) => e.course),
    homeworkSubmissions: student.homeworkSubmissions,
    examAttempts: student.examAttempts,
    videoViews: student.videoViews,
  });
}

// POST /api/teacher/students
async function createStudent(req, res) {
  const { fullName, email, password, grade, group, phone, guardianPhone } = req.body || {};

  if (!isString(fullName, { min: 1, max: 120 }) || !isEmail(email) || !isString(password, { min: 1, max: 128 }) || !isString(grade, { min: 1, max: 50 })) {
    return res.status(400).json({ message: "Full name, a valid email, password and grade are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return res.status(409).json({ message: "A user with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const qrCodeToken = uuidv4();

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "STUDENT",
      // Student.ownerTeacherId is assigned below after the nested profile exists.
      studentProfile: {
        create: {
          fullName: fullName.trim(),
          grade,
          group: str(group, 50) || null,
          phone: str(phone, 30) || null,
          guardianPhone: str(guardianPhone, 30) || null,
          qrCodeToken,
        },
      },
    },
    include: { studentProfile: true },
  });

  const qrCodeUrl = await generateStudentQrCode(user.studentProfile.id, qrCodeToken);

  const student = await prisma.student.update({
    where: { id: user.studentProfile.id },
    data: { qrCodeUrl, ownerTeacherId: req.user.id },
    include: { user: true },
  });

  res.status(201).json({ student: serializeStudent(student) });
}

// PUT /api/teacher/students/:studentId
async function updateStudent(req, res) {
  const { fullName, grade, group, phone, guardianPhone } = req.body || {};

  // Each field is only accepted if it is a string of sane length.
  const okStr = (v, max) => v === undefined || v === null || isString(v, { max });
  if (
    (fullName !== undefined && !isString(fullName, { min: 1, max: 120 })) ||
    (grade !== undefined && !isString(grade, { min: 1, max: 50 })) ||
    !okStr(group, 50) || !okStr(phone, 30) || !okStr(guardianPhone, 30)
  ) {
    return res.status(400).json({ message: "Invalid student data." });
  }

  const existing = await prisma.student.findFirst({ where: { id: req.params.studentId, ownerTeacherId: req.user.id } });
  if (!existing) return res.status(404).json({ message: "Student not found." });
  const student = await prisma.student.update({
    where: { id: existing.id },
    data: {
      ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
      ...(grade !== undefined ? { grade } : {}),
      ...(group !== undefined ? { group } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(guardianPhone !== undefined ? { guardianPhone } : {}),
    },
    include: { user: true },
  });

  res.json({ student: serializeStudent(student) });
}

// PATCH /api/teacher/students/:studentId/status  { isActive: boolean }
async function setStudentActive(req, res) {
  const student = await prisma.student.findFirst({ where: { id: req.params.studentId, ownerTeacherId: req.user.id } });
  if (!student) return res.status(404).json({ message: "Student not found." });

  await prisma.user.update({
    where: { id: student.userId },
    data: { isActive: req.body?.isActive === true },
  });

  res.json({ message: "Student status updated." });
}

// DELETE /api/teacher/students/:studentId
async function deleteStudent(req, res) {
  const student = await prisma.student.findFirst({ where: { id: req.params.studentId, ownerTeacherId: req.user.id } });
  if (!student) return res.status(404).json({ message: "Student not found." });

  // Cascades to student profile via onDelete: Cascade on the relation
  await prisma.user.delete({ where: { id: student.userId } });

  res.json({ message: "Student deleted." });
}

// POST /api/teacher/students/:studentId/reset-password  { newPassword }
async function resetPassword(req, res) {
  const { newPassword } = (req.body || {});
  if (!isString(newPassword, { min: 8, max: 128 })) {
    return res.status(400).json({ message: "New password must be 8-128 characters." });
  }

  const student = await prisma.student.findFirst({ where: { id: req.params.studentId, ownerTeacherId: req.user.id } });
  if (!student) return res.status(404).json({ message: "Student not found." });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: student.userId }, data: { passwordHash } });
  await prisma.session.updateMany({ where: { userId: student.userId, revokedAt: null }, data: { revokedAt: new Date() } });

  res.json({ message: "Password reset successfully." });
}

// POST /api/teacher/students/:studentId/regenerate-qr
async function regenerateQr(req, res) {
  const student = await prisma.student.findFirst({ where: { id: req.params.studentId, ownerTeacherId: req.user.id } });
  if (!student) return res.status(404).json({ message: "Student not found." });

  const qrCodeToken = uuidv4();
  const qrCodeUrl = await generateStudentQrCode(student.id, qrCodeToken);

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: { qrCodeToken, qrCodeUrl },
    include: { user: true },
  });

  res.json({ student: serializeStudent(updated) });
}

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  setStudentActive,
  deleteStudent,
  resetPassword,
  regenerateQr,
};
