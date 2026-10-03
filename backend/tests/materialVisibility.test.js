jest.mock("../src/config/db", () => ({ material: { findMany: jest.fn() } }));
jest.mock("../src/services/notificationService", () => ({ notifyStudents: jest.fn(), resolveTargetStudentIds: jest.fn() }));
jest.mock("../src/services/contentOwnership", () => ({
  teacherContentWhere: jest.fn(), teacherOwnsCourse: jest.fn(), teacherOwnsLesson: jest.fn(),
  teacherOwnsContent: jest.fn(), teacherOwnsTargets: jest.fn(),
}));

const prisma = require("../src/config/db");
const { getMyMaterials } = require("../src/controllers/materialController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe("student material visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.material.findMany.mockResolvedValue([]);
  });

  test("lists general materials without applying a status field the model does not have", async () => {
    const res = response();
    await getMyMaterials({ user: { studentProfile: { id: "student-1", ownerTeacherId: "teacher-1", grade: "G10", group: "A" } } }, res);

    const where = prisma.material.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain('"status"');
    expect(where.AND).toContainEqual({ courseId: null, lessonId: null, homeworkId: null });
    expect(res.body).toEqual({ materials: [] });
  });
});
