const xss = require("xss");
const prisma = require("../config/db");
const { getAccessibleVideo } = require("../services/accessService");
const { isString } = require("../utils/validate");

// Comments are only allowed on videos the caller could actually open: a
// student must be able to see the video (enrollment / visibility / dates),
// a teacher must own it. Without this, any logged-in user could read and post
// on any video just by knowing its id.
async function requireVideoAccess(req, res) {
  const { video, error } = await getAccessibleVideo(req.user, req.params.videoId);
  if (error) {
    // 404 for "no access" too, so ids can't be probed.
    res.status(error.status === 403 ? 404 : error.status).json({ message: error.message });
    return null;
  }
  return video;
}

// GET /api/videos/:videoId/comments
async function listComments(req, res) {
  const video = await requireVideoAccess(req, res);
  if (!video) return;

  const comments = await prisma.comment.findMany({
    where: { videoId: video.id, hidden: false },
    include: { user: { include: { teacherProfile: true, studentProfile: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      text: c.text,
      parentId: c.parentId,
      createdAt: c.createdAt,
      authorName: c.user.teacherProfile?.fullName || c.user.studentProfile?.fullName,
      authorRole: c.user.role,
    })),
  });
}

// POST /api/videos/:videoId/comments  { text, parentId? }
async function addComment(req, res) {
  const video = await requireVideoAccess(req, res);
  if (!video) return;

  const { text, parentId } = req.body || {};
  if (!isString(text, { min: 1 }) || !text.trim()) {
    return res.status(400).json({ message: "Comment text is required." });
  }
  if (parentId !== undefined && parentId !== null && !isString(parentId, { max: 64 })) {
    return res.status(400).json({ message: "Invalid parent comment." });
  }

  // A reply must belong to the SAME video (no threading across videos).
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.videoId !== video.id) {
      return res.status(400).json({ message: "Invalid parent comment." });
    }
  }

  const comment = await prisma.comment.create({
    data: {
      videoId: video.id,
      userId: req.user.id,
      text: xss(text.trim().slice(0, 2000)), // sanitization + length cap against spam
      parentId: parentId || null,
    },
  });
  res.status(201).json({ comment });
}

// DELETE /api/teacher/comments/:commentId
async function deleteComment(req, res) {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId }, select: { id: true, videoId: true } });
  if (!comment) return res.status(404).json({ message: "Comment not found." });
  const { error } = await getAccessibleVideo(req.user, comment.videoId);
  if (error) return res.status(404).json({ message: "Comment not found." });
  await prisma.comment.delete({ where: { id: comment.id } });
  res.json({ message: "Comment deleted." });
}

// PATCH /api/teacher/comments/:commentId/hide
async function hideComment(req, res) {
  const existing = await prisma.comment.findUnique({ where: { id: req.params.commentId }, select: { id: true, videoId: true } });
  if (!existing) return res.status(404).json({ message: "Comment not found." });
  const { error } = await getAccessibleVideo(req.user, existing.videoId);
  if (error) return res.status(404).json({ message: "Comment not found." });
  const comment = await prisma.comment.update({
    where: { id: existing.id },
    data: { hidden: req.body?.hidden === true },
  });
  res.json({ comment });
}

module.exports = { listComments, addComment, deleteComment, hideComment };
