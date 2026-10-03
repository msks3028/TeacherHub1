jest.mock("../src/config/db", () => ({
  user: { findUnique: jest.fn() },
  session: { upsert: jest.fn(), update: jest.fn() },
}));
jest.mock("../src/utils/jwt", () => ({ verifyToken: jest.fn() }));
jest.mock("../src/services/sessionService", () => ({ legacyTokenId: jest.fn() }));

const prisma = require("../src/config/db");
const { verifyToken } = require("../src/utils/jwt");
const { authenticate } = require("../src/middleware/auth");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("passes database failures to the service-unavailable error handler instead of returning 401", async () => {
  const databaseError = Object.assign(new Error("database unavailable"), { code: "P1001" });
  verifyToken.mockReturnValue({ userId: "user-1", jti: "token-1", exp: Math.floor(Date.now() / 1000) + 60 });
  prisma.user.findUnique.mockRejectedValue(databaseError);
  const req = { headers: { authorization: "Bearer valid-token" }, cookies: {} };
  const res = response();
  const next = jest.fn();

  await authenticate(req, res, next);

  expect(res.statusCode).toBe(200);
  expect(next).toHaveBeenCalledWith(databaseError);
});
