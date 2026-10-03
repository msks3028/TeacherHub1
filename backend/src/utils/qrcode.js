const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const { UPLOAD_ROOT } = require("../config/paths");

const QR_DIR = path.join(UPLOAD_ROOT, "qrcodes");

if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Generates a QR code image encoding a one-time-resolvable access URL
 * (NOT the password itself). The QR encodes: CLIENT_URL/qr-login/<qrCodeToken>
 * The frontend route exchanges the token for a short-lived login session
 * via POST /api/auth/qr-login, which the backend validates against the
 * student's real account (qrCodeToken is unique + regenerable, not a secret
 * password substitute — see README security notes).
 */
async function generateStudentQrCode(studentId, qrCodeToken) {
  const qrUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/qr-login/${qrCodeToken}`;
  const filename = `student-${studentId}.png`;
  const filePath = path.join(QR_DIR, filename);

  await QRCode.toFile(filePath, qrUrl, {
    width: 500,
    margin: 2,
  });

  return `/uploads/qrcodes/${filename}`;
}

module.exports = { generateStudentQrCode };
