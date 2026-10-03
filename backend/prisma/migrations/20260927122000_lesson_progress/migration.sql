CREATE TABLE "lesson_progress" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lesson_progress_lessonId_studentId_key" ON "lesson_progress"("lessonId", "studentId");
CREATE INDEX "lesson_progress_lessonId_completedAt_idx" ON "lesson_progress"("lessonId", "completedAt");
CREATE INDEX "lesson_progress_studentId_completedAt_idx" ON "lesson_progress"("studentId", "completedAt");
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
