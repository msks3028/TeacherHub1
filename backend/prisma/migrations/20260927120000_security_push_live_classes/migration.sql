ALTER TABLE "users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorSecretCiphertext" TEXT,
  ADD COLUMN "twoFactorRecoveryCodes" JSONB;

ALTER TABLE "students" ADD COLUMN "ownerTeacherId" TEXT;
ALTER TABLE "lessons" ADD COLUMN "createdById" TEXT;
ALTER TABLE "homework" ADD COLUMN "createdById" TEXT;
ALTER TABLE "materials" ADD COLUMN "createdById" TEXT;
ALTER TABLE "exams" ADD COLUMN "createdById" TEXT;

-- Carry forward ownership when the old single-teacher installation makes it
-- unambiguous; retain unknown legacy ownership as NULL in multi-teacher data.
UPDATE "students" s
SET "ownerTeacherId" = (SELECT u."id" FROM "users" u WHERE u."role" = 'TEACHER' LIMIT 1)
WHERE (SELECT COUNT(*) FROM "users" WHERE "role" = 'TEACHER') = 1;
WITH single_owner AS (
  SELECT ce."studentId", MIN(c."teacherId") AS "teacherId", COUNT(DISTINCT c."teacherId") AS owners
  FROM "course_enrollments" ce JOIN "courses" c ON c."id" = ce."courseId"
  GROUP BY ce."studentId"
)
UPDATE "students" s SET "ownerTeacherId" = o."teacherId"
FROM single_owner o WHERE s."id" = o."studentId" AND o.owners = 1 AND s."ownerTeacherId" IS NULL;

UPDATE "lessons" l SET "createdById" = c."teacherId" FROM "courses" c WHERE l."courseId" = c."id";
UPDATE "lessons" SET "createdById" = (SELECT "id" FROM "users" WHERE "role" = 'TEACHER' LIMIT 1)
WHERE "createdById" IS NULL AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'TEACHER') = 1;
UPDATE "homework" h SET "createdById" = c."teacherId" FROM "courses" c WHERE h."courseId" = c."id";
UPDATE "homework" h SET "createdById" = l."createdById" FROM "lessons" l
WHERE h."createdById" IS NULL AND h."lessonId" = l."id";
UPDATE "homework" SET "createdById" = (SELECT "id" FROM "users" WHERE "role" = 'TEACHER' LIMIT 1)
WHERE "createdById" IS NULL AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'TEACHER') = 1;
UPDATE "materials" m SET "createdById" = c."teacherId" FROM "courses" c WHERE m."courseId" = c."id";
UPDATE "materials" m SET "createdById" = l."createdById"
FROM "lessons" l WHERE m."createdById" IS NULL AND m."lessonId" = l."id";
UPDATE "materials" m SET "createdById" = h."createdById" FROM "homework" h
WHERE m."createdById" IS NULL AND m."homeworkId" = h."id";
UPDATE "materials" SET "createdById" = (SELECT "id" FROM "users" WHERE "role" = 'TEACHER' LIMIT 1)
WHERE "createdById" IS NULL AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'TEACHER') = 1;
UPDATE "exams" e SET "createdById" = c."teacherId" FROM "courses" c WHERE e."courseId" = c."id";
UPDATE "exams" SET "createdById" = (SELECT "id" FROM "users" WHERE "role" = 'TEACHER' LIMIT 1)
WHERE "createdById" IS NULL AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'TEACHER') = 1;

-- In a multi-teacher installation, recover an unambiguous student owner from
-- existing enrollments, assigned content, and recorded activity. Students
-- whose history spans multiple teachers remain unassigned for manual review.
WITH ownership_candidates AS (
  SELECT ce."studentId", c."teacherId" AS "ownerTeacherId"
  FROM "course_enrollments" ce JOIN "courses" c ON c."id" = ce."courseId"
  UNION
  SELECT ht."studentId", COALESCE(h."createdById", hc."teacherId", l."createdById")
  FROM "homework_targets" ht
  JOIN "homework" h ON h."id" = ht."homeworkId"
  LEFT JOIN "courses" hc ON hc."id" = h."courseId"
  LEFT JOIN "lessons" l ON l."id" = h."lessonId"
  UNION
  SELECT hs."studentId", COALESCE(h."createdById", hc."teacherId", l."createdById")
  FROM "homework_submissions" hs
  JOIN "homework" h ON h."id" = hs."homeworkId"
  LEFT JOIN "courses" hc ON hc."id" = h."courseId"
  LEFT JOIN "lessons" l ON l."id" = h."lessonId"
  UNION
  SELECT et."studentId", COALESCE(e."createdById", c."teacherId")
  FROM "exam_targets" et
  JOIN "exams" e ON e."id" = et."examId"
  LEFT JOIN "courses" c ON c."id" = e."courseId"
  UNION
  SELECT ea."studentId", COALESCE(e."createdById", c."teacherId")
  FROM "exam_attempts" ea
  JOIN "exams" e ON e."id" = ea."examId"
  LEFT JOIN "courses" c ON c."id" = e."courseId"
  UNION
  SELECT mt."studentId", COALESCE(m."createdById", mc."teacherId", h."createdById", hc."teacherId", l."createdById")
  FROM "material_targets" mt
  JOIN "materials" m ON m."id" = mt."materialId"
  LEFT JOIN "courses" mc ON mc."id" = m."courseId"
  LEFT JOIN "homework" h ON h."id" = m."homeworkId"
  LEFT JOIN "courses" hc ON hc."id" = h."courseId"
  LEFT JOIN "lessons" l ON l."id" = m."lessonId"
  UNION
  SELECT vt."studentId", COALESCE(v."createdById", c."teacherId", h."createdById", hc."teacherId", l."createdById")
  FROM "video_targets" vt
  JOIN "videos" v ON v."id" = vt."videoId"
  LEFT JOIN "courses" c ON c."id" = v."courseId"
  LEFT JOIN "homework" h ON h."id" = v."homeworkId"
  LEFT JOIN "courses" hc ON hc."id" = h."courseId"
  LEFT JOIN "lessons" l ON l."id" = v."lessonId"
  UNION
  SELECT av."studentId", a."createdById"
  FROM "announcement_targets" av
  JOIN "announcements" a ON a."id" = av."announcementId"
  UNION
  SELECT vv."studentId", COALESCE(v."createdById", c."teacherId")
  FROM "video_views" vv
  JOIN "videos" v ON v."id" = vv."videoId"
  LEFT JOIN "courses" c ON c."id" = v."courseId"
), resolved_owners AS (
  SELECT "studentId", MIN("ownerTeacherId") AS "ownerTeacherId", COUNT(DISTINCT "ownerTeacherId") AS "ownerCount"
  FROM ownership_candidates
  WHERE "ownerTeacherId" IS NOT NULL
  GROUP BY "studentId"
)
UPDATE "students" s
SET "ownerTeacherId" = o."ownerTeacherId"
FROM resolved_owners o
WHERE s."id" = o."studentId" AND o."ownerCount" = 1 AND s."ownerTeacherId" IS NULL;

CREATE INDEX "students_ownerTeacherId_idx" ON "students"("ownerTeacherId");
ALTER TABLE "students" ADD CONSTRAINT "students_ownerTeacherId_fkey"
  FOREIGN KEY ("ownerTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "materials" ADD CONSTRAINT "materials_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "lessons_createdById_idx" ON "lessons"("createdById");
CREATE INDEX "homework_createdById_idx" ON "homework"("createdById");
CREATE INDEX "materials_createdById_idx" ON "materials"("createdById");
CREATE INDEX "exams_createdById_idx" ON "exams"("createdById");

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_tokenId_key" ON "sessions"("tokenId");
CREATE INDEX "sessions_userId_revokedAt_expiresAt_idx" ON "sessions"("userId", "revokedAt", "expiresAt");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "push_subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "expirationTime" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");
CREATE INDEX "email_verification_tokens_userId_expiresAt_idx" ON "email_verification_tokens"("userId", "expiresAt");
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "live_classes" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "joinUrl" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "teacherId" TEXT NOT NULL,
  "courseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "live_classes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "live_classes_teacherId_startsAt_idx" ON "live_classes"("teacherId", "startsAt");
CREATE INDEX "live_classes_courseId_startsAt_idx" ON "live_classes"("courseId", "startsAt");
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "live_class_attendance" (
  "id" TEXT NOT NULL,
  "liveClassId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_class_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "live_class_attendance_liveClassId_studentId_key" ON "live_class_attendance"("liveClassId", "studentId");
CREATE INDEX "live_class_attendance_studentId_joinedAt_idx" ON "live_class_attendance"("studentId", "joinedAt");
ALTER TABLE "live_class_attendance" ADD CONSTRAINT "live_class_attendance_liveClassId_fkey"
  FOREIGN KEY ("liveClassId") REFERENCES "live_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_class_attendance" ADD CONSTRAINT "live_class_attendance_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
