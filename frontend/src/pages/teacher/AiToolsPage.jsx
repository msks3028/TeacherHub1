import { useState } from "react";
import toast from "react-hot-toast";
import { BarChart3, BookOpen, ClipboardList, Copy, FileQuestion, HeartHandshake, Layers, MessageSquareText, Sparkles, UserRoundSearch } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import api from "../../services/api";
import CoverHeader from "../../components/common/CoverHeader";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { Select, Textarea } from "../../components/ui/Form";

// The eight drafts the backend can write, each as a tool card. `needsCourse` mirrors the rule the generate button already enforces.
const TOOLS = [
  { key: "lesson", label: "خطة درس", desc: "مراحل الحصة وأنشطتها وزمن كل جزء.", icon: BookOpen, tone: "ct-video" },
  { key: "homework", label: "مسودة واجب", desc: "أسئلة وتمارين جاهزة للتعديل.", icon: ClipboardList, tone: "ct-homework" },
  { key: "quiz", label: "مسودة اختبار", desc: "أسئلة متنوعة مع إجاباتها.", icon: FileQuestion, tone: "ct-exam" },
  { key: "revision", label: "مادة مراجعة", desc: "ملخصات ونقاط مراجعة قبل الامتحان.", icon: Layers, tone: "ct-file" },
  { key: "summary", label: "ملخص أداء الكورس", desc: "قراءة سريعة لأداء الكورس.", icon: BarChart3, tone: "ct-ok", needsCourse: true },
  { key: "attention", label: "طلاب يحتاجون متابعة", desc: "مين محتاج اهتمام وليه.", icon: UserRoundSearch, tone: "ct-warn", needsCourse: true },
  { key: "study_plan", label: "خطة مراجعة للكورس", desc: "جدول مراجعة مقترح للطلاب.", icon: HeartHandshake, tone: "ct-note", needsCourse: true },
  { key: "feedback", label: "تغذية راجعة عامة", desc: "صياغة ملاحظات مشجّعة وواضحة.", icon: MessageSquareText, tone: "ct-info" },
];

export default function TeacherAiToolsPage() {
  const { data: courses } = useApi("/teacher/courses");
  const [task, setTask] = useState("lesson");
  const [courseId, setCourseId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate(e) {
    e.preventDefault(); setLoading(true); setDraft("");
    try { const { data } = await api.post("/teacher/ai/draft", { task, courseId: courseId || undefined, prompt }); setDraft(data.draft); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  async function copyDraft() {
    try { await navigator.clipboard.writeText(draft); toast.success("تم نسخ المسودة."); }
    catch { toast.error("تعذّر النسخ من هذا المتصفح."); }
  }

  const tool = TOOLS.find((t) => t.key === task) || TOOLS[0];
  const needsCourse = Boolean(tool.needsCourse) && !courseId;

  return <>
    <CoverHeader eyebrow="مساعد المدرس" title="أدوات الذكاء الاصطناعي" description="أنشئ مسودات تعليمية لتراجعها وتعدّلها قبل استخدامها مع الطلاب." />
    <div className="grid xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] gap-5 items-start">
      <form onSubmit={generate} className="space-y-5">
        <fieldset>
          <legend className="mb-2.5 text-sm font-bold text-ink-2">اختر الأداة</legend>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="نوع المسودة">
            {TOOLS.map((t) => {
              const on = t.key === task;
              return (
                <label key={t.key} className="block cursor-pointer">
                  <input type="radio" name="ai-tool" className="sr-only peer" checked={on} onChange={() => setTask(t.key)} />
                  <span className="card card-interactive flex h-full flex-col gap-2.5 p-3.5 peer-checked:border-primary-ink peer-checked:bg-primary-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]">
                    <span className={`ct ct-sm ${t.tone}`}><Icon icon={t.icon} size={18} /></span>
                    <span className="text-sm font-bold leading-snug text-ink">{t.label}</span>
                    <span className="text-xs leading-snug text-ink-3">{t.desc}</span>
                    {t.needsCourse && <span className="badge badge-info self-start">يحتاج كورس</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="card space-y-4 p-4 sm:p-5">
          <Select label="كورس مرتبط (اختياري)" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">بدون كورس</option>{(courses?.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select>
          <Textarea label="الموضوع أو المطلوب" required minLength={5} maxLength={4000} rows={6} hint="لا تضف اسم طالب أو معلومات شخصية." placeholder="اكتب الموضوع والمرحلة الدراسية والتفاصيل المهمة..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button type="submit" size="lg" icon={Sparkles} loading={loading} disabled={prompt.trim().length < 5 || needsCourse} className="w-full">إنشاء مسودة</Button>
          {needsCourse && <p className="text-center text-xs font-semibold text-warn">اختر كورسًا عشان تقدر تنشئ "{tool.label}".</p>}
        </div>
      </form>
      <section className="card overflow-hidden xl:sticky xl:top-[calc(var(--topbar-h)+16px)]" aria-live="polite" aria-busy={loading}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5" style={{ background: "var(--primary-soft)" }}>
          <div className="flex min-w-0 items-center gap-3"><span className={`ct ct-sm ${tool.tone}`}><Icon icon={tool.icon} size={18} /></span><h2 className="truncate font-bold text-ink">{draft ? "المسودة جاهزة" : tool.label}</h2></div>
          {draft && <Button size="sm" variant="secondary" icon={Copy} onClick={copyDraft}>نسخ</Button>}
        </header>
        <div className="min-h-64 p-4 sm:p-5">
          {loading ? (
            <div role="status" aria-label="جارِ إنشاء المسودة" className="space-y-3 py-2">
              {[92, 100, 78, 96, 64].map((w, i) => <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />)}
              <p className="pt-2 text-sm text-ink-3">جارِ إنشاء المسودة…</p>
            </div>
          ) : draft ? (
            <div dir="auto" className="anim-fade whitespace-pre-wrap break-words text-sm leading-7 text-ink">{draft}</div>
          ) : (
            <div className="grid place-items-center py-12 text-center"><span className={`ct ct-lg ${tool.tone}`}><Icon icon={tool.icon} size={24} /></span><p className="mt-4 max-w-xs text-sm text-ink-3">ستظهر المسودة هنا. المحتوى الناتج غير محفوظ تلقائيًا.</p></div>
          )}
        </div>
      </section>
    </div>
  </>;
}
