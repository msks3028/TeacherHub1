const crypto = require("crypto");

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value) {
  const normalized = String(value || "").replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error("Invalid authenticator secret.");
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const char of normalized) {
    buffer = (buffer << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

function codeAt(secret, timeStep) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret, code, at = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  try {
    const step = Math.floor(at / 30_000);
    const supplied = Buffer.from(String(code));
    for (let offset = -1; offset <= 1; offset += 1) {
      const expected = Buffer.from(codeAt(secret, step + offset));
      if (crypto.timingSafeEqual(supplied, expected)) return true;
    }
  } catch { /* malformed stored/setup secret */ }
  return false;
}

function encryptionKey() {
  const configured = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (configured.length < 32) throw new Error("TOTP encryption requires a strong TOTP_ENCRYPTION_KEY or JWT_SECRET.");
  return crypto.createHash("sha256").update(configured).digest();
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptSecret(value) {
  const [version, iv, tag, ciphertext] = String(value || "").split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted authenticator secret.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

module.exports = { generateSecret, verifyTotp, encryptSecret, decryptSecret };
