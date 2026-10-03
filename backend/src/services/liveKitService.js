const { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } = require("livekit-server-sdk");

function isConfigured() {
  return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

function providerUrl() {
  if (!isConfigured()) {
    const error = new Error("In-platform live classes are not configured.");
    error.statusCode = 503;
    throw error;
  }
  let url;
  try { url = new URL(process.env.LIVEKIT_URL); } catch {
    const error = new Error("LiveKit server URL is invalid.");
    error.statusCode = 503;
    throw error;
  }
  if (url.username || url.password || !["wss:", "ws:", "https:", "http:"].includes(url.protocol)) {
    const error = new Error("LiveKit server URL must use a secure WebSocket or HTTPS origin.");
    error.statusCode = 503;
    throw error;
  }
  if (process.env.NODE_ENV === "production" && !["wss:", "https:"].includes(url.protocol)) {
    const error = new Error("LiveKit must use TLS in production.");
    error.statusCode = 503;
    throw error;
  }
  url.protocol = url.protocol === "wss:" ? "https:" : url.protocol === "ws:" ? "http:" : url.protocol;
  return url.origin;
}

function roomNameFor(liveClass) {
  return liveClass.liveKitRoomName || `teacherhub-${liveClass.id}`;
}

function roomClient() {
  return new RoomServiceClient(providerUrl(), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
}

function webhookReceiver() {
  if (!isConfigured()) return null;
  return new WebhookReceiver(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
}

async function createRoom(liveClass) {
  const name = roomNameFor(liveClass);
  const client = roomClient();
  const active = await client.listRooms([name]);
  if (!active.length) {
    await client.createRoom({
      name,
      emptyTimeout: 15 * 60,
      departureTimeout: 2 * 60,
      maxParticipants: 500,
      metadata: JSON.stringify({ liveClassId: liveClass.id }),
    });
  }
  return name;
}

async function issueToken({ liveClass, identity, name, role, profileId }) {
  if (!liveClass.liveKitRoomName) {
    const error = new Error("This class has not started yet.");
    error.statusCode = 409;
    throw error;
  }
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    name: String(name || "TeacherHub participant").slice(0, 100),
    metadata: JSON.stringify({ role, profileId }),
    ttl: "2h",
  });
  token.addGrant({
    roomJoin: true,
    room: liveClass.liveKitRoomName,
    ...(role === "TEACHER" ? { canPublish: true } : { canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] }),
    canSubscribe: true,
    canPublishData: true,
    ...(role === "TEACHER" ? { roomAdmin: true } : {}),
  });
  return { url: process.env.LIVEKIT_URL, token: await token.toJwt() };
}

async function deleteRoomIfPresent(name) {
  if (!name) return;
  const client = roomClient();
  const active = await client.listRooms([name]);
  if (active.length) await client.deleteRoom(name);
}

module.exports = { isConfigured, providerUrl, roomNameFor, roomClient, webhookReceiver, createRoom, issueToken, deleteRoomIfPresent };
