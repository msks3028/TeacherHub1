jest.mock("../src/middleware/auth", () => {
  const actual = jest.requireActual("../src/middleware/auth");
  return {
    ...actual,
    authenticate(req, res, next) {
      req.user = { id: "test-user", role: req.get("x-test-role") };
      next();
    },
  };
});

jest.mock("../src/controllers/teacherAiController", () => ({
  generateTeacherDraft: jest.fn((req, res) => res.json({ draft: "teacher draft" })),
}));

jest.mock("../src/controllers/aiController", () => ({
  listConversations: (req, res) => res.json({ feature: "student-ai" }),
  sendMessage: (req, res) => res.json({ feature: "student-ai" }),
}));

const express = require("express");
const request = require("supertest");
const teacherAiRoutes = require("../src/routes/teacherAiRoutes");
const studentAiRoutes = require("../src/routes/aiRoutes");
const { generateTeacherDraft } = require("../src/controllers/teacherAiController");

const app = express();
app.use(express.json());
app.use("/api/teacher/ai", teacherAiRoutes);
app.use("/api/student/ai", studentAiRoutes);

describe("AI role access", () => {
  beforeEach(() => jest.clearAllMocks());

  test("denies teachers the retained teacher-draft endpoint", async () => {
    const response = await request(app).post("/api/teacher/ai/draft").set("x-test-role", "TEACHER").send({ task: "lesson" });

    expect(response.status).toBe(403);
    expect(generateTeacherDraft).not.toHaveBeenCalled();
  });

  test("does not expose teacher drafts to students and preserves student AI access", async () => {
    const forbidden = await request(app).post("/api/teacher/ai/draft").set("x-test-role", "STUDENT").send({ task: "lesson" });
    const allowed = await request(app).get("/api/student/ai/conversations").set("x-test-role", "STUDENT");

    expect(forbidden.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ feature: "student-ai" });
  });

  test("keeps student AI limited to the student role", async () => {
    const response = await request(app).get("/api/student/ai/conversations").set("x-test-role", "TEACHER");

    expect(response.status).toBe(403);
  });
});
