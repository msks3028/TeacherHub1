jest.mock("../src/config/db", () => ({
  courseEnrollment: { findUnique: jest.fn() },
  videoTarget: { findFirst: jest.fn() },
  homeworkTarget: { findFirst: jest.fn() },
  materialTarget: { findFirst: jest.fn() },
  lessonTarget: { findFirst: jest.fn() },
  examTarget: { findFirst: jest.fn() },
  video: { findUnique: jest.fn() },
  homework: { findUnique: jest.fn() },
  lesson: { findUnique: jest.fn() },
  course: { findFirst: jest.fn() },
}));

const prisma = require("../src/config/db");
const { studentCanSee, isStudentEnrolledInCourse, getAccessibleVideo } = require("../src/services/accessService");

const student = { id: "student-1", ownerTeacherId: "teacher-1", grade: "G10", group: "A" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isStudentEnrolledInCourse", () => {
  test("content with no course is always considered accessible (general content gate)", async () => {
    expect(await isStudentEnrolledInCourse(student.id, null)).toBe(true);
    expect(prisma.courseEnrollment.findUnique).not.toHaveBeenCalled();
  });

  test("returns true only when an enrollment row actually exists", async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: "e1", course: { status: "PUBLISHED" } });
    expect(await isStudentEnrolledInCourse(student.id, "course-1")).toBe(true);
  });

  test("returns false when there is no enrollment row", async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);
    expect(await isStudentEnrolledInCourse(student.id, "course-1")).toBe(false);
  });
});

describe("studentCanSee — visibility rules", () => {
  test("ALL_STUDENTS is visible to any student", async () => {
    const row = { id: "v1", courseId: null, createdById: student.ownerTeacherId, visibility: "ALL_STUDENTS" };
    expect(await studentCanSee("video", student, row)).toBe(true);
  });

  test("GRADE-scoped content only matches the student's own grade", async () => {
    const sameGrade = { id: "v1", courseId: null, createdById: student.ownerTeacherId, visibility: "GRADE", grade: "G10" };
    const otherGrade = { id: "v2", courseId: null, createdById: student.ownerTeacherId, visibility: "GRADE", grade: "G11" };
    expect(await studentCanSee("video", student, sameGrade)).toBe(true);
    expect(await studentCanSee("video", student, otherGrade)).toBe(false);
  });

  test("GROUP-scoped content only matches the student's own group", async () => {
    const sameGroup = { id: "v1", courseId: null, createdById: student.ownerTeacherId, visibility: "GROUP", group: "A" };
    const otherGroup = { id: "v2", courseId: null, createdById: student.ownerTeacherId, visibility: "GROUP", group: "B" };
    expect(await studentCanSee("video", student, sameGroup)).toBe(true);
    expect(await studentCanSee("video", student, otherGroup)).toBe(false);
  });

  test("a GROUP row with no group set is never visible (guards against an accidental match-everyone bug)", async () => {
    const noGroup = { id: "v1", courseId: null, createdById: student.ownerTeacherId, visibility: "GROUP", group: null };
    expect(await studentCanSee("video", student, noGroup)).toBe(false);
  });

  test("SPECIFIC_STUDENTS checks the *Target join table for this exact student", async () => {
    prisma.videoTarget.findFirst.mockResolvedValue({ id: "t1" });
    const row = { id: "v1", courseId: null, createdById: student.ownerTeacherId, visibility: "SPECIFIC_STUDENTS" };
    expect(await studentCanSee("video", student, row)).toBe(true);
    expect(prisma.videoTarget.findFirst).toHaveBeenCalledWith({
      where: { videoId: "v1", studentId: student.id },
    });
  });

  test("SPECIFIC_STUDENTS denies a student with no matching target row", async () => {
    prisma.videoTarget.findFirst.mockResolvedValue(null);
    const row = { id: "v1", courseId: null, createdById: student.ownerTeacherId, visibility: "SPECIFIC_STUDENTS" };
    expect(await studentCanSee("video", student, row)).toBe(false);
  });

  test("content tied to a course the student is not enrolled in is denied regardless of visibility", async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);
    const row = { id: "v1", courseId: "course-1", visibility: "ALL_STUDENTS" };
    expect(await studentCanSee("video", student, row)).toBe(false);
  });

  test("general content from another teacher is denied even when marked ALL_STUDENTS", async () => {
    const row = { id: "v2", courseId: null, createdById: "teacher-2", visibility: "ALL_STUDENTS" };
    expect(await studentCanSee("video", student, row)).toBe(false);
  });

  test("course content is available only after enrollment, regardless of creator", async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: "enrollment", course: { status: "PUBLISHED" } });
    const row = { id: "v3", courseId: "course-1", createdById: "teacher-2", visibility: "ALL_STUDENTS" };
    expect(await studentCanSee("video", student, row)).toBe(true);
  });

  test("an unrecognized visibility value denies access by default (fail closed, not fail open)", async () => {
    const row = { id: "v1", courseId: null, visibility: "SOMETHING_UNEXPECTED" };
    expect(await studentCanSee("video", student, row)).toBe(false);
  });

  test("a material attached to a lesson inherits the lesson's visibility", async () => {
    prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson-1", courseId: null, createdById: student.ownerTeacherId,
      status: "PUBLISHED", visibility: "SPECIFIC_STUDENTS",
    });
    prisma.lessonTarget.findFirst.mockResolvedValue(null);
    const material = {
      id: "material-1", courseId: null, lessonId: "lesson-1",
      createdById: student.ownerTeacherId, visibility: "ALL_STUDENTS",
    };

    expect(await studentCanSee("material", student, material)).toBe(false);
  });

  test("a material attached to homework inherits the homework's visibility", async () => {
    prisma.homework.findUnique.mockResolvedValue({
      id: "homework-1", courseId: null, lessonId: null, createdById: student.ownerTeacherId,
      status: "PUBLISHED", visibility: "SPECIFIC_STUDENTS",
    });
    prisma.homeworkTarget.findFirst.mockResolvedValue(null);
    const material = {
      id: "material-1", courseId: null, homeworkId: "homework-1",
      createdById: student.ownerTeacherId, visibility: "ALL_STUDENTS",
    };

    expect(await studentCanSee("material", student, material)).toBe(false);
  });
});

describe("getAccessibleVideo", () => {
  test("a teacher can always access their content, including before its start date", async () => {
    const teacher = { role: "TEACHER", id: "teacher-1" };
    prisma.video.findUnique.mockResolvedValue({ id: "v1", createdById: teacher.id, startDate: new Date(Date.now() + 100000) });
    const result = await getAccessibleVideo(teacher, "v1");
    expect(result.error).toBeUndefined();
    expect(result.video.id).toBe("v1");
  });

  test("a teacher cannot play another teacher's video by id", async () => {
    prisma.video.findUnique.mockResolvedValue({ id: "v1", createdById: "teacher-2" });
    const result = await getAccessibleVideo({ role: "TEACHER", id: "teacher-1" }, "v1");
    expect(result.error.status).toBe(404);
  });

  test("returns 404 (not 403) for a video id that does not exist, so ids can't be probed", async () => {
    prisma.video.findUnique.mockResolvedValue(null);
    const result = await getAccessibleVideo({ role: "STUDENT" }, "missing");
    expect(result.error.status).toBe(404);
  });

  test("an expired video is denied to students with a 410", async () => {
    prisma.video.findUnique.mockResolvedValue({
      id: "v1",
      expirationDate: new Date(Date.now() - 1000),
      courseId: null,
    });
    const result = await getAccessibleVideo({ role: "STUDENT", studentProfile: student }, "v1");
    expect(result.error.status).toBe(410);
  });

  test("a video scheduled in the future is denied to students with a 403", async () => {
    prisma.video.findUnique.mockResolvedValue({
      id: "v1",
      startDate: new Date(Date.now() + 100000),
      courseId: null,
    });
    const result = await getAccessibleVideo({ role: "STUDENT", studentProfile: student }, "v1");
    expect(result.error.status).toBe(403);
  });

  test("a homework's explanation video is gated by who can see that homework, not its own targets", async () => {
    prisma.video.findUnique.mockResolvedValue({ id: "v1", homeworkId: "hw1", courseId: null });
    prisma.homework.findUnique.mockResolvedValue({ id: "hw1", courseId: null, createdById: student.ownerTeacherId, status: "PUBLISHED", visibility: "ALL_STUDENTS" });
    const result = await getAccessibleVideo({ role: "STUDENT", studentProfile: student }, "v1");
    expect(result.error).toBeUndefined();
    expect(prisma.homework.findUnique).toHaveBeenCalledWith({ where: { id: "hw1" } });
  });
});
