const crypto = require("crypto");
const prisma = require("../config/db");
const { verifyTotp, decryptSecret } = require("../utils/totp");

function normalizeRecoveryCode(code) {
  return String(code || "").replace(/[\s-]/g, "").toUpperCase();
}

function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

async function verifySecondFactor(user, code) {
  if (!user?.twoFactorEnabled || !user.twoFactorSecretCiphertext || typeof code !== "string") return false;
  try {
    if (verifyTotp(decryptSecret(user.twoFactorSecretCiphertext), code)) return true;
  } catch { /* continue to one-time recovery codes */ }

  const hashed = hashRecoveryCode(code);
  let consumed = false;
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: user.id }, select: { twoFactorRecoveryCodes: true } });
      const hashes = Array.isArray(current?.twoFactorRecoveryCodes) ? current.twoFactorRecoveryCodes : [];
      if (!hashes.includes(hashed)) return;
      const result = await tx.user.updateMany({
        where: { id: user.id, twoFactorRecoveryCodes: { equals: hashes } },
        data: { twoFactorRecoveryCodes: hashes.filter((item) => item !== hashed) },
      });
      consumed = result.count === 1;
    }, { isolationLevel: "Serializable" });
  } catch { return false; }
  return consumed;
}

module.exports = { verifySecondFactor, hashRecoveryCode, normalizeRecoveryCode };
