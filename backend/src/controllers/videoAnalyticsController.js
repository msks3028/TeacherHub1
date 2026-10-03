const prisma = require("../config/db");
const { resolveTargetStudentIds } = require("../services/notificationService");
const { teacherContentWhere } = require("../services/contentOwnership");

// GET /api/teacher/videos/:videoId/analytics
async function getVideoAnalytics(req, res) {
  const { videoId } = req.params;
  const video = await prisma.video.findFirst({ where: { id: videoId, ...teacherContentWhere(req.user.id) } });
  if (!video) return res.status(404).json({ message: "Video not found." });

  const targetIds = await resolveTargetStudentIds({
    courseId: video.courseId, visibility: video.visibility, grade: video.grade,
    group: video.group, id: video.id, targetModel: "videoTarget", targetField: "videoId", teacherId: req.user.id,
  });

  const views = await prisma.videoView.findMany({
    where: { videoId, student: { ownerTeacherId: req.user.id } },
    include: { student: true },
    orderBy: { lastWatchedAt: "desc" },
  });

  const watchedIds = new Set(views.map((v) => v.studentId));
  const notWatched = await prisma.student.findMany({
    where: { id: { in: targetIds.filter((id) => !watchedIds.has(id)) } },
    select: { id: true, fullName: true },
  });

  res.json({
    totalAssigned: targetIds.length,
    totalViews: views.length,
    studentsWatched: views.length,
    studentsNotWatched: notWatched.length,
    watchedBy: views.map((v) => ({
      studentId: v.studentId,
      studentName: v.student.fullName,
      lastWatchedAt: v.lastWatchedAt,
      progressSeconds: v.progressSeconds,
      completed: v.completed,
    })),
    notWatchedBy: notWatched,
  });
}

module.exports = { getVideoAnalytics };
