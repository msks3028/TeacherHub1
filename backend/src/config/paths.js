const path = require("path");
const fs = require("fs");

// Single source of truth for where uploaded files (videos, PDFs, QR images,
// submissions) live on disk.
//
// By default this is <project>/backend/uploads. Set UPLOAD_DIR in .env to a
// fixed folder OUTSIDE the project (e.g. C:/teacherhub-uploads) so that
// extracting a new copy of the project into another folder never "loses"
// the files that were already uploaded.
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

module.exports = { UPLOAD_ROOT };
