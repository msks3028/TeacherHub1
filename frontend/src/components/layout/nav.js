import {
  LayoutDashboard, Users, BookOpen, Video, ClipboardList, FileText, FileQuestion,
  Megaphone, Bell, User, Palette, Sparkles, Award, CalendarDays, ShieldCheck,
} from "lucide-react";

// group: "content" | "account".  `tab: true` → pinned in the phone bottom bar.
export const TEACHER_NAV = [
  { to: "/teacher", label: "الرئيسية", end: true, icon: LayoutDashboard, tone: "primary", group: "content", tab: true },
  { to: "/teacher/students", label: "الطلاب", icon: Users, tone: "info", group: "content", tab: true },
  { to: "/teacher/courses", label: "الكورسات", icon: BookOpen, tone: "primary", group: "content", tab: true },
  { to: "/teacher/homework", label: "الواجبات", icon: ClipboardList, tone: "homework", group: "content", tab: true },
  { to: "/teacher/videos", label: "الفيديوهات", icon: Video, tone: "video", group: "content" },
  { to: "/teacher/materials", label: "الملفات", icon: FileText, tone: "file", group: "content" },
  { to: "/teacher/exams", label: "الاختبارات", icon: FileQuestion, tone: "exam", group: "content" },
  { to: "/teacher/announcements", label: "الإعلانات", icon: Megaphone, tone: "note", group: "content" },
  { to: "/teacher/live-classes", label: "الحصص المباشرة", icon: CalendarDays, tone: "bad", group: "content" },
  { to: "/teacher/analytics", label: "تحليلات الطلاب", icon: Award, tone: "ok", group: "content" },
  { to: "/teacher/notifications", label: "الإشعارات", icon: Bell, tone: "warn", group: "account" },
  { to: "/teacher/security", label: "الأمان والجلسات", icon: ShieldCheck, tone: "ok", group: "account" },
  { to: "/teacher/profile", label: "الملف الشخصي", icon: User, tone: "neutral", group: "account" },
  { to: "/teacher/appearance", label: "تخصيص المنصة", icon: Palette, tone: "exam", group: "account" },
];

export const STUDENT_NAV = [
  { to: "/student", label: "الرئيسية", end: true, icon: LayoutDashboard, tone: "primary", group: "content", tab: true },
  { to: "/student/courses", label: "الكورسات", icon: BookOpen, tone: "primary", group: "content", tab: true },
  { to: "/student/homework", label: "الواجبات", icon: ClipboardList, tone: "homework", group: "content", tab: true },
  { to: "/student/exams", label: "الاختبارات", icon: FileQuestion, tone: "exam", group: "content", tab: true },
  { to: "/student/videos", label: "الفيديوهات", icon: Video, tone: "video", group: "content" },
  { to: "/student/materials", label: "الملازم", icon: FileText, tone: "file", group: "content" },
  { to: "/student/results", label: "النتائج", icon: Award, tone: "ok", group: "content" },
  { to: "/student/ai", label: "المساعد الذكي", icon: Sparkles, tone: "info", group: "content" },
  { to: "/student/announcements", label: "الإعلانات", icon: Megaphone, tone: "note", group: "content" },
  { to: "/student/live-classes", label: "الحصص المباشرة", icon: CalendarDays, tone: "bad", group: "content" },
  { to: "/student/notifications", label: "الإشعارات", icon: Bell, tone: "warn", group: "account" },
  { to: "/student/security", label: "الأمان والجلسات", icon: ShieldCheck, tone: "ok", group: "account" },
  { to: "/student/profile", label: "الملف الشخصي", icon: User, tone: "neutral", group: "account" },
];

// Each destination gets the colour of the kind of content it holds (same tokens as the content cards).
export const TONE_CLS = {
  primary: "ct-primary", video: "ct-video", homework: "ct-homework", exam: "ct-exam", file: "ct-file",
  note: "ct-note", ok: "ct-ok", warn: "ct-warn", bad: "ct-bad", info: "ct-info", neutral: "ct-neutral",
};
