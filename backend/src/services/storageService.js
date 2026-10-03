// Optional cloud object storage backend.
//
// By default (no STORAGE_DRIVER set, or STORAGE_DRIVER=local) nothing here is
// used at all — every uploaded file stays on the local disk exactly as
// before, so existing setups are completely unaffected.
//
// Setting STORAGE_DRIVER=s3 (plus the STORAGE_* variables below) switches the
// app to push every uploaded video/PDF/image/submission to an S3-compatible
// bucket right after it's saved locally and verified, then deletes the local
// copy. This is what makes the app safe to deploy on hosts with an ephemeral
// disk (Render, Railway, Fly.io, most container platforms): a redeploy or
// restart no longer loses previously uploaded files, because they never
// depended on that disk in the first place.
//
// "S3-compatible" covers, with no code changes — only different env values:
//   - AWS S3              (STORAGE_ENDPOINT unset, STORAGE_REGION=us-east-1 etc.)
//   - Cloudflare R2        (STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com)
//   - Backblaze B2         (STORAGE_ENDPOINT=https://s3.<region>.backblazeb2.com)
//   - Supabase Storage     (S3-compatible endpoint, see Supabase Storage settings)
//   - MinIO (self-hosted)  (STORAGE_ENDPOINT=https://your-minio-host)
const fs = require("fs");
const logger = require("../utils/logger");

const DRIVER = (process.env.STORAGE_DRIVER || "local").toLowerCase();
const isRemoteEnabled = DRIVER === "s3";

let s3Client = null;
let PutObjectCommand, DeleteObjectCommand, GetObjectCommand, Upload, getSignedUrl;

if (isRemoteEnabled) {
  // Only required when actually enabled, so `npm install` + local dev never
  // needs AWS credentials or these packages configured.
  ({ S3Client: s3Client } = require("@aws-sdk/client-s3"));
  ({ PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3"));
  ({ Upload } = require("@aws-sdk/lib-storage"));
  ({ getSignedUrl } = require("@aws-sdk/s3-request-presigner"));
}

const BUCKET = process.env.STORAGE_BUCKET;
const REGION = process.env.STORAGE_REGION || "auto";
const PUBLIC_BASE_URL = process.env.STORAGE_PUBLIC_URL; // e.g. a CDN or R2 public bucket URL, no trailing slash

const client = isRemoteEnabled
  ? new s3Client({
      region: REGION,
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      },
    })
  : null;

if (isRemoteEnabled && !BUCKET) {
  throw new Error(
    "STORAGE_DRIVER=s3 is set but STORAGE_BUCKET is missing. Set STORAGE_BUCKET (and the other STORAGE_* variables) in .env."
  );
}

// Uploads a file already saved on local disk to the bucket, under the same
// relative key the app already uses for the local path (e.g. "videos/uuid.mp4").
// Uses a stream (not a Buffer) and the multipart-aware `Upload` helper so a
// multi-hundred-MB video never has to be held in memory at once.
async function uploadLocalFile(key, localPath, contentType) {
  const stream = fs.createReadStream(localPath);
  const upload = new Upload({
    client,
    params: { Bucket: BUCKET, Key: key, Body: stream, ContentType: contentType },
  });
  await upload.done();
}

async function deleteRemoteObject(key) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    logger.warn("Could not delete object from remote storage", { key, error: err.message });
  }
}

// Videos/PDFs/submissions are private — access is already checked by the
// controller before this is called, so a short-lived signed URL is safe to
// hand back. It natively supports HTTP Range requests, so video seeking keeps
// working without us re-implementing Range parsing against S3 ourselves.
async function getSignedGetUrl(key, { expiresInSeconds = 300, downloadFilename = null } = {}) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(downloadFilename ? { ResponseContentDisposition: `attachment; filename="${downloadFilename}"` } : {}),
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// Images are public content (course covers, avatars, the platform logo) —
// no signing needed, just a stable URL. Prefer STORAGE_PUBLIC_URL (a CDN or
// the bucket's public endpoint) when set; otherwise fall back to the
// standard virtual-hosted-style S3 URL.
function getPublicUrl(key) {
  if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  const endpoint = (process.env.STORAGE_ENDPOINT || `https://s3.${REGION}.amazonaws.com`).replace(/^https?:\/\//, "");
  return `https://${BUCKET}.${endpoint}/${key}`;
}

module.exports = {
  isRemoteEnabled,
  uploadLocalFile,
  deleteRemoteObject,
  getSignedGetUrl,
  getPublicUrl,
};
