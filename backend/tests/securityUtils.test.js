const { verifyTotp, encryptSecret, decryptSecret } = require("../src/utils/totp");

describe("TOTP and secret protection", () => {
  test("matches the RFC 6238 SHA-1 six-digit test vector at 59 seconds", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(verifyTotp(secret, "287083", 59_000)).toBe(false);
  });

  test("encrypts authenticator secrets and rejects tampering", () => {
    const previousKey = process.env.TOTP_ENCRYPTION_KEY;
    process.env.TOTP_ENCRYPTION_KEY = "test-only-key-material-with-32-chars-minimum";
    try {
      const secret = "JBSWY3DPEHPK3PXP";
      const ciphertext = encryptSecret(secret);
      expect(ciphertext).not.toContain(secret);
      expect(decryptSecret(ciphertext)).toBe(secret);
      const parts = ciphertext.split(".");
      parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
      expect(() => decryptSecret(parts.join("."))).toThrow();
    } finally {
      if (previousKey === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
      else process.env.TOTP_ENCRYPTION_KEY = previousKey;
    }
  });
});
