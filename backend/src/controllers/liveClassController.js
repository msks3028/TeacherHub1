const prisma = require("../config/db");
const { isString } = require("../utils/validate");
const { notifyStudents } = require("../services/notificationService");
const { audit } = require("../services/auditService");
const liveKit = require("../services/liveKitService");
const { TrackSource } = require("livekit-server-sdk");

function parseDates(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (!startsAt || Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 5 * 60_000) return null;
  if (end && (Number.isNaN(end.getTime()) || end <= start)) return null;
  return { start, end };
}

async function ownedClass(id, teacherId) {
  return prisma.liveClass.findFirst({ where: { id, teacherId } });
}

function publicClass(item) {
  if (!item) return item;
  const { joinUrl, liveKitRoomName, ...visible } = item;
  return visible;
}

async function findRecipients({ teacherId, courseId, visibility, grade, group, studentIds }) {
  const where = {
    user: { isActive: true },
    ...(courseId ? { enrollments: { some: { courseId } } } : { ownerTeacherId: teacherId }),
  };
  if (visibility === "GRADE") where.grade = grade;
  if (visibility === "GROUP") Object.assign(where, { grade, group });
  if (visibility === "SPECIFIC_STUDENTS") where.id = { in: studentIds };
  return prisma.student.findMany({ where, select: { id: true } });
}

async function listTeacherLiveClasses(req, res) {
  const classes = await prisma.liveClass.findMany({
    where: { teacherId: req.user.id },
    include: {
      course: { select: { id: true, title: true } },
      lesson: { select: { id: true, title: true } },
      attendance: { where: { verifiedAt: { not: null } }, include: { student: { select: { id: true, fullName: true } } }, orderBy: { joinedAt: "desc" }, take: 200 },
      _count: { select: { attendance: { where: { verifiedAt: { not: null } } } } },
    },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  res.set("Cache-Control", "no-store").json({ liveClasses: classes.map((item) => {
    const visible = publicClass(item);
    return { ...visible, attendanceCount: item._count.attendance, attendance: visible.attendance };
  }) });
}

async function createLiveClass(req, res) {
  if (!liveKit.isConfigured()) return res.status(503).json({ message: "الفصول المباشرة الداخلية غير مهيأة بعد على الخادم." });
  const { title, description, courseId, lessonId, startsAt, endsAt } = req.body || {};
  const dates = parseDates(startsAt, endsAt);
  const visibility = req.body?.visibility || "ALL_STUDENTS";
  const grade = req.body?.grade || null;
  const group = req.body?.group || null;
  const studentIds = req.body?.studentIds || [];
  const validScopes = ["ALL_STUDENTS", "GRADE", "GROUP", "SPECIFIC_STUDENTS"];
  if (!isString(title, { min: 1, max: 200 }) || (description != null && !isString(description, { max: 3000 })) || !dates || !validScopes.includes(visibility)) {
    return res.status(400).json({ message: "أدخل عنوانًا وموعدًا ومجموعة طلاب صالحة للحصة." });
  }
  if ((visibility === "GRADE" || visibility === "GROUP") && !isString(grade, { min: 1, max: 100 })) return res.status(400).json({ message: "المرحلة الدراسية مطلوبة لهذا النوع من الاستهداف." });
  if (visibility === "GROUP" && !isString(group, { min: 1, max: 100 })) return res.status(400).json({ message: "المجموعة مطلوبة لهذا النوع من الاستهداف." });
  if (visibility === "SPECIFIC_STUDENTS" && (!Array.isArray(studentIds) || !studentIds.length || studentIds.length > 2000 || studentIds.some((id) => !isString(id, { min: 1, max: 64 })) || new Set(studentIds).size !== studentIds.length)) {
    return res.status(400).json({ message: "اختر طالبًا واحدًا على الأقل دون تكرار." });
  }

  if (courseId && !await prisma.course.findFirst({ where: { id: courseId, teacherId: req.user.id }, select: { id: true } })) return res.status(404).json({ message: "الكورس غير موجود." });
  if (lessonId) {
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, ...(courseId ? { courseId } : { createdById: req.user.id }) }, select: { id: true } });
    if (!lesson) return res.status(404).json({ message: "الدرس غير موجود في هذا الكورس." });
  }
  if (lessonId && !courseId) return res.status(400).json({ message: "اربط الدرس بكورس مملوك لك قبل جدولة حصة مرتبطة به." });

  const recipients = await findRecipients({ teacherId: req.user.id, courseId, visibility, grade, group, studentIds });
  if (visibility === "SPECIFIC_STUDENTS" && recipients.length !== studentIds.length) return res.status(400).json({ message: "بعض الطلاب المختارين غير متاحين لهذا الكورس." });

  const liveClass = await prisma.liveClass.create({
    data: {
      title: title.trim(), description: description?.trim() || null,
      startsAt: dates.start, endsAt: dates.end, courseId: courseId || null,
      lessonId: lessonId || null, teacherId: req.user.id, visibility, grade, group,
      ...(visibility === "SPECIFIC_STUDENTS" ? { targets: { create: recipients.map(({ id }) => ({ studentId: id })) } } : {}),
    },
    include: { course: { select: { id: true, title: true } }, lesson: { select: { id: true, title: true } } },
  });
  await notifyStudents(recipients.map(({ id }) => id), { type: "ANNOUNCEMENT", category: "LIVE_CLASSES", title: `حصة مباشرة: ${liveClass.title}`, body: liveClass.course?.title || "حصة جديدة مجدولة", link: "/student/live-classes" });
  audit(req, "live_class_created", { targetType: "live_class", targetId: liveClass.id });
  res.status(201).json({ liveClass: publicClass(liveClass) });
}

async function updateLiveClass(req, res) {
  const existing = await ownedClass(req.params.liveClassId, req.user.id);
  if (!existing) return res.status(404).json({ message: "الحصة غير موجودة." });
  if (existing.status !== "SCHEDULED" || existing.cancelledAt) return res.status(409).json({ message: "لا يمكن تعديل حصة بدأت أو انتهت." });
  const body = req.body || {};
  const data = {};
  if (body.title !== undefined) {
    if (!isString(body.title, { min: 1, max: 200 })) return res.status(400).json({ message: "عنوان الحصة غير صالح." });
    data.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (body.description != null && !isString(body.description, { max: 3000 })) return res.status(400).json({ message: "الوصف غير صالح." });
    data.description = body.description?.trim() || null;
  }
  if (body.startsAt !== undefined || body.endsAt !== undefined) {
    const dates = parseDates(body.startsAt ?? existing.startsAt, body.endsAt === undefined ? existing.endsAt : body.endsAt);
    if (!dates) return res.status(400).json({ message: "موعد الحصة غير صالح." });
    data.startsAt = dates.start;
    data.endsAt = dates.end;
  }
  const liveClass = await prisma.liveClass.update({ where: { id: existing.id }, data, include: { course: { select: { id: true, title: true } }, lesson: { select: { id: true, title: true } } } });
  audit(req, "live_class_updated", { targetType: "live_class", targetId: existing.id });
  res.json({ liveClass: publicClass(liveClass) });
}

async function cancelLiveClass(req, res) {
  const liveClass = await ownedClass(req.params.liveClassId, req.user.id);
  if (!liveClass) return res.status(404).json({ message: "الحصة غير موجودة." });
  if (liveClass.status === "ENDED") return res.status(409).json({ message: "الحصة المنتهية لا يمكن إلغاؤها." });
  if (liveClass.liveKitRoomName) await liveKit.deleteRoomIfPresent(liveClass.liveKitRoomName);
  await prisma.liveClass.update({ where: { id: liveClass.id }, data: { status: "CANCELLED", cancelledAt: liveClass.cancelledAt || new Date(), endedAt: liveClass.liveKitRoomName ? new Date() : null } });
  audit(req, "live_class_cancelled", { targetType: "live_class", targetId: liveClass.id });
  res.json({ message: "تم إلغاء الحصة." });
}

async function startLiveClass(req, res) {
  const liveClass = await ownedClass(req.params.liveClassId, req.user.id);
  if (!liveClass || liveClass.cancelledAt || ["CANCELLED", "ENDED"].includes(liveClass.status)) return res.status(404).json({ message: "الحصة غير متاحة." });
  if (liveClass.status !== "SCHEDULED") return res.status(409).json({ message: "الحصة بدأت بالفعل؛ استخدم زر الانضمام." });
  if (Date.now() < liveClass.startsAt.getTime() - 30 * 60_000) return res.status(409).json({ message: "يمكن بدء الحصة قبل موعدها بنصف ساعة فقط." });
  if (liveClass.endsAt && liveClass.endsAt.getTime() <= Date.now()) return res.status(409).json({ message: "انتهى موعد هذه الحصة." });
  const roomName = await liveKit.createRoom(liveClass);
  const started = await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: { liveKitRoomName: roomName, status: "LIVE", startedAt: liveClass.startedAt || new Date(), endedAt: null },
  });
  const credentials = await liveKit.issueToken({ liveClass: started, identity: `teacher-${req.user.id}`, name: req.user.teacherProfile?.fullName || req.user.email, role: "TEACHER", profileId: req.user.id });
  audit(req, "live_class_started", { targetType: "live_class", targetId: liveClass.id });
  res.set("Cache-Control", "no-store").json({ liveClass: publicClass(started), ...credentials });
}

async function endLiveClass(req, res) {
  const liveClass = await ownedClass(req.params.liveClassId, req.user.id);
  if (!liveClass || liveClass.status !== "LIVE") return res.status(404).json({ message: "الحصة غير مفعّلة الآن." });
  await liveKit.deleteRoomIfPresent(liveClass.liveKitRoomName);
  await prisma.liveClass.update({ where: { id: liveClass.id }, data: { status: "ENDED", endedAt: new Date() } });
  audit(req, "live_class_ended", { targetType: "live_class", targetId: liveClass.id });
  res.json({ message: "انتهت الحصة." });
}

async function teacherJoinLiveClass(req, res) {
  const liveClass = await ownedClass(req.params.liveClassId, req.user.id);
  if (!liveClass || liveClass.status !== "LIVE") return res.status(404).json({ message: "الحصة غير مفعّلة الآن." });
  const credentials = await liveKit.issueToken({ liveClass, identity: `teacher-${req.user.id}`, name: req.user.teacherProfile?.fullName || req.user.email, role: "TEACHER", profileId: req.user.id });
  res.set("Cache-Control", "no-store").json(credentials);
}

function studentScope(student) {
  return [
    { visibility: "ALL_STUDENTS" },
    ...(student.grade ? [{ visibility: "GRADE", grade: student.grade }] : []),
    ...(student.grade && student.group ? [{ visibility: "GROUP", grade: student.grade, group: student.group }] : []),
    { visibility: "SPECIFIC_STUDENTS", targets: { some: { studentId: student.id } } },
  ];
}

function visibleToStudentWhere(student) {
  return {
    cancelledAt: null,
    status: { in: ["SCHEDULED", "LIVE"] },
    AND: [{ OR: studentScope(student) }],
    OR: [
      { course: { status: "PUBLISHED", enrollments: { some: { studentId: student.id } } } },
      ...(student.ownerTeacherId ? [{ courseId: null, teacherId: student.ownerTeacherId }] : []),
    ],
  };
}

async function listStudentLiveClasses(req, res) {
  const student = req.user.studentProfile;
  const liveClasses = await prisma.liveClass.findMany({
    where: visibleToStudentWhere(student),
    include: { course: { select: { id: true, title: true } }, lesson: { select: { id: true, title: true } }, attendance: { where: { studentId: student.id, verifiedAt: { not: null } }, select: { joinedAt: true, lastJoinedAt: true, durationSeconds: true } } },
    orderBy: { startsAt: "asc" }, take: 100,
  });
  res.set("Cache-Control", "no-store").json({ liveClasses: liveClasses.map((item) => {
    const visible = publicClass(item);
    return { ...visible, attendedAt: item.attendance[0]?.joinedAt || null, attendance: undefined };
  }) });
}

async function studentJoinLiveClass(req, res) {
  const student = req.user.studentProfile;
  const liveClass = await prisma.liveClass.findFirst({
    where: { id: req.params.liveClassId, ...visibleToStudentWhere(student), liveKitRoomName: { not: null }, status: "LIVE" },
    select: { id: true, title: true, liveKitRoomName: true, status: true, startedAt: true },
  });
  if (!liveClass) return res.status(404).json({ message: "الحصة غير متاحة لحسابك الآن." });
  const credentials = await liveKit.issueToken({ liveClass, identity: `student-${student.id}`, name: student.fullName, role: "STUDENT", profileId: student.id });
  res.set("Cache-Control", "no-store").json({ ...credentials, liveClass: { id: liveClass.id, title: liveClass.title } });
}

async function listParticipants(req, res) {
  const liveClass = await ownedClass(req.params.liveClassId, req.user.id);
  if (!liveClass || liveClass.status !== "LIVE" || !liveClass.liveKitRoomName) return res.status(404).json({ message: "الحصة غير مفعّلة الآن." });
  const participants = await liveKit.roomClient().listParticipants(liveClass.liveKitRoomName);
  res.set("Cache-Control", "no-store").json({ participants: participants.filter((participant) => participant.identity.startsWith("student-")).map((participant) => ({
    identity: participant.identity,
    name: participant.name,
    tracks: participant.tracks.map((track) => ({ sid: track.sid, source: track.source, muted: track.muted })),
  })) });
}

async function moderateParticipant(req, res) {
  const { liveClassId, identity, action } = req.params;
  const liveClass = await ownedClass(liveClassId, req.user.id);
  if (!liveClass || liveClass.status !== "LIVE" || !liveClass.liveKitRoomName || !/^student-[a-f0-9-]{20,64}$/i.test(identity)) return res.status(404).json({ message: "المشارك غير موجود في هذه الحصة." });
  const client = liveKit.roomClient();
  const participants = await client.listParticipants(liveClass.liveKitRoomName);
  const participant = participants.find((item) => item.identity === identity);
  if (!participant) return res.status(404).json({ message: "المشارك غير موجود في هذه الحصة." });
  if (action === "remove") await client.removeParticipant(liveClass.liveKitRoomName, identity);
  else if (action === "mute") {
    const microphoneTracks = participant.tracks.filter((track) => track.source === TrackSource.MICROPHONE);
    await Promise.all(microphoneTracks.map((track) => client.mutePublishedTrack(liveClass.liveKitRoomName, identity, track.sid, true)));
  } else return res.status(400).json({ message: "إجراء الإشراف غير معروف." });
  audit(req, `live_class_participant_${action}`, { targetType: "live_class", targetId: liveClass.id, details: { identity } });
  res.json({ message: action === "remove" ? "تم إخراج الطالب من الحصة." : "تم كتم الميكروفون." });
}

module.exports = {
  listTeacherLiveClasses, createLiveClass, updateLiveClass, cancelLiveClass,
  startLiveClass, endLiveClass, teacherJoinLiveClass,
  listStudentLiveClasses, studentJoinLiveClass, listParticipants, moderateParticipant,
};
