import { PlayCircle, PenLine, ListChecks, FileText, Megaphone } from "lucide-react";

/**
 * One fixed icon + colour per kind of content, used in every list, card and
 * dashboard so students learn the language once.
 */
export const CONTENT_TYPES = {
  video: { label: "فيديو", icon: PlayCircle, cls: "ct-video" },
  homework: { label: "واجب", icon: PenLine, cls: "ct-homework" },
  exam: { label: "اختبار", icon: ListChecks, cls: "ct-exam" },
  file: { label: "ملف", icon: FileText, cls: "ct-file" },
  note: { label: "إعلان", icon: Megaphone, cls: "ct-note" },
};
