CREATE TABLE "units" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "courseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "units_courseId_idx" ON "units"("courseId");
CREATE UNIQUE INDEX "units_courseId_position_key" ON "units"("courseId", "position");
ALTER TABLE "units" ADD CONSTRAINT "units_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lessons"
  ADD COLUMN "unitId" TEXT,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Preserve every existing Course -> Lesson edge. Every legacy course gets a
-- unit, and its existing lessons are assigned in their original insertion
-- order with zero-based positions.
INSERT INTO "units" ("id", "title", "courseId", "position", "createdAt", "updatedAt")
SELECT
  'legacy-unit-' || c."id",
  CASE WHEN COUNT(l."id") > 0 THEN 'المحتوى السابق' ELSE 'الوحدة الأولى' END,
  c."id",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "courses" c
LEFT JOIN "lessons" l ON l."courseId" = c."id"
GROUP BY c."id";

WITH ordered_lessons AS (
  SELECT "id", "courseId", ROW_NUMBER() OVER (PARTITION BY "courseId" ORDER BY "createdAt" ASC, "id" ASC) - 1 AS position
  FROM "lessons"
  WHERE "courseId" IS NOT NULL
)
UPDATE "lessons" AS l
SET "unitId" = 'legacy-unit-' || o."courseId",
    "position" = o.position
FROM ordered_lessons AS o
WHERE l."id" = o."id";

ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "lessons_unitId_position_idx" ON "lessons"("unitId", "position");
CREATE UNIQUE INDEX "lessons_unitId_position_key" ON "lessons"("unitId", "position");
