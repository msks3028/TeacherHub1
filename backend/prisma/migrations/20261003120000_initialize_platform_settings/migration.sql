-- Seed the singleton defaults without replacing any teacher-configured values.
INSERT INTO "platform_settings" (
  "id", "platformName", "primaryColor", "sidebarColor", "buttonColor",
  "textColor", "backgroundColor", "cardStyle", "updatedAt"
)
VALUES (
  'singleton', 'TeacherHub', '#4F46E5', '#111827', '#4F46E5',
  '#111827', '#F9FAFB', 'rounded', CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
