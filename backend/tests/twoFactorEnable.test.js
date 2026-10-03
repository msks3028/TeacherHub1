jest.mock("../src/config/db", () => ({
  user: { findUnique: jest.fn(), updateMany: jest.fn() },
  session: { updateMany: jest.fn() },
}));
jest.mock("bcryptjs", () => ({ compare: jest.fn() }));
jest.mock("../src/utils/totp", () => ({ verifyTotp: jest.fn(() => true), encryptSecret: jest.fn(() => "encrypted-test-secret"), generateSecret: jest.fn() }));
jest.mock("../src/services/securityService", () => ({ verifySecondFactor: jest.fn(), hashRecoveryCode: jest.fn((value) => `hashed:${value}`) }));
jest.mock("../src/services/auditService", () => ({ audit: jest.fn() }));
jest.mock("../src/services/notificationService", () => ({ notifyUser: jest.fn() }));

const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");
const controller = require("../src/controllers/securityController");

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe("enabling two-factor authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "hash", twoFactorEnabled: false });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    bcrypt.compare.mockResolvedValue(true);
  });

  test("requires the current password at the final enable step", async () => {
    bcrypt.compare.mockResolvedValue(false);
    const res = response();
    await controller.enableTwoFactor({ user: { id: "user-1", email: "user@example.test", role: "STUDENT" }, body: { secret: "A".repeat(20), code: "123456", password: "wrong" } }, res);
    expect(res.statusCode).toBe(401);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  test("enables only when password and authenticator code are valid", async () => {
    const res = response();
    await controller.enableTwoFactor({ user: { id: "user-1", email: "user@example.test", role: "STUDENT" }, authSession: { id: "current" }, body: { secret: "A".repeat(20), code: "123456", password: "correct" } }, res);
    expect(res.statusCode).toBe(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1", twoFactorEnabled: false } }));
    expect(res.body.recoveryCodes).toHaveLength(8);
  });
});
