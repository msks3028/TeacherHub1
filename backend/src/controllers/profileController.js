const prisma = require("../config/db");
const { isString, isSafeHttpUrl, isUploadUrl } = require("../utils/validate");

// Profile links/images are shown to other users, so they must be plain
// http(s) URLs (or one of our own uploaded images). A "javascript:" link here
// would run in the browser of whoever clicks it.
const isImageRef = (v) => isSafeHttpUrl(v) || isUploadUrl("image", v);
const optional = (v, ok) => v === undefined || v === null || v === "" || ok(v);

// GET /api/teacher/profile
async function getTeacherProfile(req, res) {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
  res.json({ teacher, email: req.user.email });
}

// PUT /api/teacher/profile
async function updateTeacherProfile(req, res) {
  const {
    fullName, avatarUrl, bio, phone,
    facebook, instagram, youtube, tiktok, telegram, whatsapp, x, linkedin, website,
  } = req.body || {};

  const links = { facebook, instagram, youtube, tiktok, telegram, whatsapp, x, linkedin, website };
  const badLink = Object.values(links).some((v) => !optional(v, (u) => isSafeHttpUrl(u)));
  if (
    badLink ||
    !optional(avatarUrl, isImageRef) ||
    (fullName !== undefined && !isString(fullName, { min: 1, max: 120 })) ||
    !optional(bio, (v) => isString(v, { max: 3000 })) ||
    !optional(phone, (v) => isString(v, { max: 30 }))
  ) {
    return res.status(400).json({ message: "بيانات غير صالحة. الروابط يجب أن تبدأ بـ http:// أو https://" });
  }

  const teacher = await prisma.teacher.update({
    where: { userId: req.user.id },
    data: {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(phone !== undefined ? { phone } : {}),
      facebook, instagram, youtube, tiktok, telegram, whatsapp, x, linkedin, website,
    },
  });
  res.json({ teacher });
}

// GET /api/student/profile
async function getStudentProfile(req, res) {
  const student = await prisma.student.findUnique({
    where: { userId: req.user.id },
    include: { enrollments: { include: { course: true } } },
  });
  res.json({ student, email: req.user.email });
}

// PUT /api/student/profile
// A student can edit their own profile page: name, photo and phone numbers.
// Grade, group, e-mail and enrolment stay with the teacher — they decide what
// content the student can see, so a student must not be able to change them.
async function updateStudentProfile(req, res) {
  const { fullName, avatarUrl, phone, guardianPhone } = req.body || {};
  const name = typeof fullName === "string" ? fullName.trim() : fullName;
  const phoneOk = (v) => optional(v, (x) => isString(x, { max: 30 }));

  if (
    (name !== undefined && !isString(name, { min: 2, max: 120 })) ||
    // a student's photo must be one uploaded through our own endpoint (no external links)
    !optional(avatarUrl, (v) => isUploadUrl("image", v)) ||
    !phoneOk(phone) ||
    !phoneOk(guardianPhone)
  ) {
    return res.status(400).json({ message: "بيانات غير صالحة. تأكد من الاسم وأرقام الهاتف." });
  }

  const student = await prisma.student.update({
    where: { userId: req.user.id },
    data: {
      ...(name !== undefined ? { fullName: name } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
      ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
      ...(guardianPhone !== undefined ? { guardianPhone: guardianPhone ? guardianPhone.trim() : null } : {}),
    },
  });
  res.json({ student });
}

module.exports = { getTeacherProfile, updateTeacherProfile, getStudentProfile, updateStudentProfile };
