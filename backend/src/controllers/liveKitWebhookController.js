const prisma = require("../config/db");
const liveKit = require("../services/liveKitService");

function safeProfileId(identity) {
  const match = /^student-([a-f0-9-]{20,64})$/i.exec(identity || "");
  return match?.[1] || null;
}

async function eligibleStudent(client, liveClass, studentId) {
  const student = await client.student.findUnique({
    where: { id: studentId },
    select: { id: true, grade: true, group: true, ownerTeacherId: true, user: { select: { isActive: true } } },
  });
  if (!student || !student.user.isActive) return false;

  if (liveClass.courseId) {
    const enrollment = await client.courseEnrollment.findFirst({
      where: { studentId, courseId: liveClass.courseId, course: { teacherId: liveClass.teacherId, status: "PUBLISHED" } },
      select: { id: true },
    });
    if (!enrollment) return false;
  } else if (student.ownerTeacherId !== liveClass.teacherId) return false;

  if (liveClass.visibility === "GRADE" && student.grade !== liveClass.grade) return false;
  if (liveClass.visibility === "GROUP" && (student.grade !== liveClass.grade || student.group !== liveClass.group)) return false;
  if (liveClass.visibility === "SPECIFIC_STUDENTS") {
    const target = await client.liveClassTarget.findUnique({ where: { liveClassId_studentId: { liveClassId: liveClass.id, studentId } }, select: { id: true } });
    if (!target) return false;
  }
  return true;
}

async function processVerifiedEvent(event) {
  const eventId = event.id;
  if (!eventId || !event.event || !event.room?.name) return;
  await prisma.$transaction(async (tx) => {
    await tx.processedLiveKitEvent.create({ data: { providerEventId: eventId, eventType: event.event } });
    const liveClass = await tx.liveClass.findFirst({ where: { liveKitRoomName: event.room.name } });
    if (!liveClass) return;

    if (event.event === "room_finished") {
      await tx.liveClass.updateMany({
        where: { id: liveClass.id, status: "LIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      });
      return;
    }

    const studentId = safeProfileId(event.participant?.identity);
    if (!studentId || !["participant_joined", "participant_left"].includes(event.event)) return;
    if (liveClass.cancelledAt || liveClass.status === "CANCELLED") return;

    const now = new Date(Number(event.createdAt || Date.now() / 1000) * 1000);
    if (Number.isNaN(now.getTime())) return;

    // Provider signatures authenticate the event; re-check current membership/visibility
    // before associating its participant identity with student attendance.
    if (event.event === "participant_joined") {
      if (liveClass.status !== "LIVE" || (liveClass.startedAt && now.getTime() < liveClass.startedAt.getTime() - 60_000)) return;
      if (!(await eligibleStudent(tx, liveClass, studentId))) return;
      await tx.liveClassAttendance.upsert({
        where: { liveClassId_studentId: { liveClassId: liveClass.id, studentId } },
        create: { liveClassId: liveClass.id, studentId, joinedAt: now, lastJoinedAt: now, verifiedAt: now, joinCount: 1 },
        update: { lastJoinedAt: now, lastLeftAt: null, joinCount: { increment: 1 }, verifiedAt: now },
      });
    } else {
      // A signed departure can arrive just after the teacher ends the room.
      // Close only an attendance interval that was already verified at join.
      if (!["LIVE", "ENDED"].includes(liveClass.status)) return;
      const attendance = await tx.liveClassAttendance.findUnique({ where: { liveClassId_studentId: { liveClassId: liveClass.id, studentId } } });
      if (attendance?.verifiedAt && attendance.lastJoinedAt && !attendance.lastLeftAt) {
        const seconds = Math.max(0, Math.floor((now.getTime() - attendance.lastJoinedAt.getTime()) / 1000));
        await tx.liveClassAttendance.update({
          where: { id: attendance.id },
          data: { lastLeftAt: now, durationSeconds: { increment: seconds } },
        });
      }
    }
  });
}

async function receiveWebhook(req, res) {
  const receiver = liveKit.webhookReceiver();
  if (!receiver) return res.status(503).json({ message: "LiveKit is not configured." });
  if (!Buffer.isBuffer(req.body) || req.body.length > 1024 * 1024) return res.status(400).json({ message: "Invalid webhook payload." });
  let event;
  try {
    event = await receiver.receive(req.body.toString("utf8"), req.get("Authorization"));
  } catch {
    return res.status(401).json({ message: "Invalid LiveKit webhook signature." });
  }

  try {
    await processVerifiedEvent(event);
  } catch (error) {
    // LiveKit retries non-2xx responses. Duplicate event IDs are safe because the
    // event record and attendance mutation commit in the same database transaction.
    if (error.code === "P2002") return res.status(200).json({ received: true, duplicate: true });
    throw error;
  }
  res.status(200).json({ received: true });
}

module.exports = { receiveWebhook, processVerifiedEvent, eligibleStudent };
