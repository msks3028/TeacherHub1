const jwt = require("jsonwebtoken");
const liveKit = require("../src/services/liveKitService");

describe("LiveKit room credentials", () => {
  const keys = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "NODE_ENV"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.LIVEKIT_URL = "wss://video.example.test";
    process.env.LIVEKIT_API_KEY = "test-api-key";
    process.env.LIVEKIT_API_SECRET = "test-api-secret-with-enough-entropy";
  });
  afterAll(() => keys.forEach((key) => original[key] === undefined ? delete process.env[key] : process.env[key] = original[key]));

  test("issues room-scoped student grants without room administration", async () => {
    const credentials = await liveKit.issueToken({
      liveClass: { id: "class-1", liveKitRoomName: "room-1" },
      identity: "student-00000000-0000-4000-8000-000000000001",
      name: "Student", role: "STUDENT", profileId: "00000000-0000-4000-8000-000000000001",
    });
    const claims = jwt.decode(credentials.token);
    expect(credentials.url).toBe("wss://video.example.test");
    expect(claims.video).toMatchObject({ roomJoin: true, room: "room-1", canSubscribe: true, canPublishData: true });
    expect(claims.video.canPublish).not.toBe(true);
    expect(claims.video.canPublishSources).toEqual(expect.arrayContaining(["camera", "microphone"]));
    expect(claims.video.canPublishSources).not.toContain("screen_share");
    expect(claims.video.roomAdmin).not.toBe(true);
  });

  test("requires TLS for production providers", () => {
    process.env.NODE_ENV = "production";
    process.env.LIVEKIT_URL = "ws://video.example.test";
    expect(() => liveKit.providerUrl()).toThrow("LiveKit must use TLS in production.");
  });
});
