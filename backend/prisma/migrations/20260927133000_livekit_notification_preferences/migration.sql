-- Upgrade link-only classes to LiveKit-backed rooms without deleting legacy data.
ALTER TABLE "live_classes" ALTER COLUMN "joinUrl" DROP NOT NULL;
ALTER TABLE "live_classes"
  ADD COLUMN "liveKitRoomName" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "visibility" "AnnouncementScope" NOT NULL DEFAULT 'ALL_STUDENTS',
  ADD COLUMN "grade" TEXT,
  ADD COLUMN "group" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "lessonId" TEXT;
CREATE UNIQUE INDEX "live_classes_liveKitRoomName_key" ON "live_classes"("liveKitRoomName");
CREATE INDEX "live_classes_lessonId_idx" ON "live_classes"("lessonId");
CREATE INDEX "live_classes_status_startsAt_idx" ON "live_classes"("status", "startsAt");
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "live_classes" SET "status" = 'CANCELLED' WHERE "cancelledAt" IS NOT NULL;

-- Previous attendance rows were created by a Join-button request, not a room event.
-- Leave verifiedAt NULL so they remain visible only as legacy, unverified records.
ALTER TABLE "live_class_attendance"
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "lastJoinedAt" TIMESTAMP(3),
  ADD COLUMN "lastLeftAt" TIMESTAMP(3),
  ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "joinCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "live_class_targets" (
  "id" TEXT NOT NULL,
  "liveClassId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  CONSTRAINT "live_class_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "live_class_targets_liveClassId_studentId_key" ON "live_class_targets"("liveClassId", "studentId");
CREATE INDEX "live_class_targets_studentId_idx" ON "live_class_targets"("studentId");
ALTER TABLE "live_class_targets" ADD CONSTRAINT "live_class_targets_liveClassId_fkey"
  FOREIGN KEY ("liveClassId") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_class_targets" ADD CONSTRAINT "live_class_targets_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "processed_livekit_events" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_livekit_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "processed_livekit_events_providerEventId_key" ON "processed_livekit_events"("providerEventId");
CREATE INDEX "processed_livekit_events_processedAt_idx" ON "processed_livekit_events"("processedAt");

CREATE TYPE "NotificationCategory" AS ENUM ('HOMEWORK', 'EXAMS', 'MATERIALS', 'VIDEOS', 'ANNOUNCEMENTS', 'LIVE_CLASSES', 'SECURITY');
ALTER TABLE "notifications"
  ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'ANNOUNCEMENTS',
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");
UPDATE "notifications"
SET "category" = CASE
  WHEN "type" IN ('HOMEWORK_ADDED', 'HOMEWORK_GRADED', 'HOMEWORK_SUBMITTED', 'NEEDS_GRADING') THEN 'HOMEWORK'::"NotificationCategory"
  WHEN "type" IN ('EXAM_ADDED', 'EXAM_GRADED', 'EXAM_COMPLETED') THEN 'EXAMS'::"NotificationCategory"
  WHEN "type" = 'MATERIAL_ADDED' THEN 'MATERIALS'::"NotificationCategory"
  WHEN "type" = 'VIDEO_ADDED' THEN 'VIDEOS'::"NotificationCategory"
  ELSE 'ANNOUNCEMENTS'::"NotificationCategory"
END;

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_preferences_userId_category_key" ON "notification_preferences"("userId", "category");
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
