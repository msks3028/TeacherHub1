jest.mock("../src/config/db", () => ({ $transaction: jest.fn() }));

const prisma = require("../src/config/db");
const { processVerifiedEvent } = require("../src/controllers/liveKitWebhookController");

const studentId = "00000000-0000-4000-8000-000000000001";
const liveClass = {
  id: "class-1", courseId: "course-1", teacherId: "teacher-1", visibility: "ALL_STUDENTS",
  status: "LIVE", cancelledAt: null, startedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function client() {
  return {
    processedLiveKitEvent: { create: jest.fn().mockResolvedValue({}) },
    liveClass: { findFirst: jest.fn().mockResolvedValue(liveClass), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    student: { findUnique: jest.fn().mockResolvedValue({ id: studentId, grade: null, group: null, ownerTeacherId: null, user: { isActive: true } }) },
    courseEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: "enrollment-1" }) },
    liveClassAttendance: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    liveClassTarget: { findUnique: jest.fn() },
  };
}

describe("verified LiveKit attendance events", () => {
  let tx;
  beforeEach(() => {
    jest.clearAllMocks();
    tx = client();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
  });

  test("records a currently eligible student from a signed room-join event", async () => {
    await processVerifiedEvent({ id: "evt-join-1", event: "participant_joined", createdAt: 1767225900, room: { name: "room-1" }, participant: { identity: `student-${studentId}` } });
    expect(tx.liveClassAttendance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { liveClassId_studentId: { liveClassId: "class-1", studentId } },
      create: expect.objectContaining({ studentId, verifiedAt: expect.any(Date), joinCount: 1 }),
    }));
  });

  test("does not record attendance for a class that is no longer live", async () => {
    tx.liveClass.findFirst.mockResolvedValue({ ...liveClass, status: "ENDED" });
    await processVerifiedEvent({ id: "evt-join-ended", event: "participant_joined", createdAt: 1767225900, room: { name: "room-1" }, participant: { identity: `student-${studentId}` } });
    expect(tx.liveClassAttendance.upsert).not.toHaveBeenCalled();
  });

  test("does not record attendance without an active course enrollment", async () => {
    tx.courseEnrollment.findFirst.mockResolvedValue(null);
    await processVerifiedEvent({ id: "evt-join-ineligible", event: "participant_joined", createdAt: 1767225900, room: { name: "room-1" }, participant: { identity: `student-${studentId}` } });
    expect(tx.liveClassAttendance.upsert).not.toHaveBeenCalled();
  });

  test("closes a verified attendance interval when the provider reports departure after the teacher ends", async () => {
    tx.liveClass.findFirst.mockResolvedValue({ ...liveClass, status: "ENDED" });
    tx.liveClassAttendance.findUnique.mockResolvedValue({
      id: "attendance-1", verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastJoinedAt: new Date("2026-01-01T00:05:00.000Z"), lastLeftAt: null,
    });
    await processVerifiedEvent({ id: "evt-left-after-end", event: "participant_left", createdAt: 1767226200, room: { name: "room-1" }, participant: { identity: `student-${studentId}` } });
    expect(tx.liveClassAttendance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "attendance-1" },
      data: { lastLeftAt: new Date("2026-01-01T00:10:00.000Z"), durationSeconds: { increment: 300 } },
    }));
  });
});
