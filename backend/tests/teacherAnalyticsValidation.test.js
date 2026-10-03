jest.mock("../src/middleware/auth", () => {
  const actual = jest.requireActual("../src/middleware/auth");
  return {
    ...actual,
    authenticate(req, res, next) {
      req.user = { id: "teacher-test", role: req.get("x-test-role") };
      next();
    },
  };
});

jest.mock("../src/config/db", () => ({}));

const express = require("express");
const request = require("supertest");
const teacherAnalyticsRoutes = require("../src/routes/teacherAnalyticsRoutes");

const app = express();
app.use("/api/teacher/analytics", teacherAnalyticsRoutes);

function utcDateOffset(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("teacher analytics HTTP date validation", () => {
  test("accepts current-day date-only semantics but rejects a future end date", async () => {
    const today = utcDateOffset(0);
    const future = utcDateOffset(1);
    const response = await request(app)
      .get(`/api/teacher/analytics?from=${today}&to=${future}`)
      .set("x-test-role", "TEACHER");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("لا يمكن اختيار تاريخ مستقبلي.");
  });

  test("keeps the 366-day backend limit and rejects overlong ranges", async () => {
    const today = utcDateOffset(0);
    const from = utcDateOffset(-366);
    const response = await request(app)
      .get(`/api/teacher/analytics?from=${from}&to=${today}`)
      .set("x-test-role", "TEACHER");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("الحد الأقصى لنطاق التحليلات 366 يومًا.");
  });

  test("retains teacher-only authorization for analytics", async () => {
    const response = await request(app)
      .get(`/api/teacher/analytics?from=${utcDateOffset(-1)}&to=${utcDateOffset(0)}`)
      .set("x-test-role", "STUDENT");

    expect(response.status).toBe(403);
  });
});
