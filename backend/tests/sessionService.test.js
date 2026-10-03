jest.mock("../src/config/db", () => ({ session: { findFirst: jest.fn(), create: jest.fn() } }));
jest.mock("../src/utils/jwt", () => ({ signToken: jest.fn(() => "signed-session-token"), verifyToken: jest.fn(() => ({ jti: "session-id", exp: 2_000_000_000 })) }));

const prisma = require("../src/config/db");
const { issueSession, safeDeviceLabel } = require("../src/services/sessionService");

describe("session creation and new-device detection", () => {
  beforeEach(() => { jest.clearAllMocks(); prisma.session.create.mockResolvedValue({ id: "session-id" }); });

  test("labels a browser safely without exposing the user agent", async () => {
    prisma.session.findFirst.mockResolvedValue(null);
    const session = await issueSession({ headers: { "user-agent": "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36" }, ip: "192.0.2.10" }, "user-1", "STUDENT");
    expect(session).toEqual({ token: "signed-session-token", isNewDevice: true, deviceLabel: "Chrome" });
    expect(prisma.session.create.mock.calls[0][0].data.userAgent).toContain("Chrome/123");
    expect(session.deviceLabel).not.toContain("192.0.2.10");
  });

  test("does not classify a matching active session as a new device", async () => {
    prisma.session.findFirst.mockResolvedValue({ id: "existing-session" });
    const session = await issueSession({ headers: { "user-agent": "Firefox/124" }, ip: "192.0.2.11" }, "user-1", "TEACHER");
    expect(session.isNewDevice).toBe(false);
  });

  test("uses a generic label for unknown and missing user agents", () => {
    expect(safeDeviceLabel("unrecognized agent" )).toBe("متصفح جديد");
    expect(safeDeviceLabel()).toBe("متصفح جديد");
  });
});
