jest.mock("../src/utils/logger", () => ({ error: jest.fn() }));

const logger = require("../src/utils/logger");
const { notFound, errorHandler } = require("../src/middleware/errorHandler");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe("API error responses", () => {
  beforeEach(() => logger.error.mockClear());

  test("does not echo unknown request URLs or query strings", () => {
    const res = response();
    notFound({ method: "GET", originalUrl: "/missing?token=secret" }, res);
    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  test("logs a route path without query parameters and returns generic server errors", () => {
    const res = response();
    errorHandler(new Error("internal detail"), { path: "/api/private", originalUrl: "/api/private?token=secret", method: "GET" }, res, jest.fn());
    expect(logger.error).toHaveBeenCalledWith("internal detail", expect.objectContaining({ path: "/api/private" }));
    expect(logger.error.mock.calls[0][1].path).not.toContain("secret");
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("internal detail");
  });

  test("does not echo an upload field name from a Multer error", () => {
    const res = response();
    const err = Object.assign(new Error("Unexpected field password"), { name: "MulterError", code: "LIMIT_UNEXPECTED_FILE" });
    errorHandler(err, { path: "/api/upload", method: "POST" }, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  test("reports database connectivity failures as a generic service-unavailable response", () => {
    const res = response();
    const err = Object.assign(new Error("Database host and credentials are private"), { code: "P1001" });

    errorHandler(err, { path: "/api/student/courses", method: "GET" }, res, jest.fn());

    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("credentials");
    expect(JSON.stringify(res.body)).not.toContain("P1001");
  });
});
