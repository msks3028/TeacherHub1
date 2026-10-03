import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarPlus, Play, Video, Users, XCircle, PhoneOff, Search, CheckCircle2 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Icon from "../../components/ui/Icon";
import { Input, Select, Textarea } from "../../components/ui/Form";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/StateViews";

const localDateTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const formatDate = (date) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const STATUS_ACCENT = { LIVE: "var(--pen)", SCHEDULED: "var(--primary)", ENDED: "var(--line-strong)", CANCELLED: "var(--line-strong)" };
const VISIBILITY_LABELS = { ALL_STUDENTS: "كل الطلاب المؤهلين", GRADE: "مرحلة دراسية", GROUP: "مجموعة دراسية", SPECIFIC_STUDENTS: "طلاب محددون" };

export default function TeacherLiveClassesPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi("/teacher/live-classes");
  const { data: courseData } = useApi("/teacher/courses");
  const { data: studentData } = useApi("/teacher/students?limit=100");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", courseId: "", lessonId: "", visibility: "ALL_STUDENTS", grade: "", group: "", startsAt: localDateTime(new Date(Date.now() + 60 * 60 * 1000)), endsAt: "" });
  const lessonUrl = form.courseId ? `/teacher/lessons?courseId=${encodeURIComponent(form.courseId)}` : null;
  const { data: lessonData } = useApi(lessonUrl, { enabled: Boolean(form.courseId) });
  const classes = data?.liveClasses || [];
  const visibleStudents = useMemo(() => (studentData?.students || []).filter((student) => `${student.fullName} ${student.email}`.toLowerCase().includes(studentSearch.toLowerCase())), [studentData, studentSearch]);

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/teacher/live-classes", { ...form, courseId: form.courseId || undefined, lessonId: form.lessonId || undefined, studentIds: form.visibility === "SPECIFIC_STUDENTS" ? selectedStudents : [], startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null });
      toast.success("تمت جدولة الفصل الداخلي وإشعار الطلاب المؤهلين.");
      setOpen(false);
      setSelectedStudents([]);
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function openRoom(item, start = false) {
    try {
      const path = `/teacher/live-classes/${item.id}/${start ? "start" : "join"}`;
      const { data: credentials } = await api.post(path);
      navigate(`/teacher/live-classes/${item.id}/room`, { state: { liveKitUrl: credentials.url, liveKitToken: credentials.token, liveClass: credentials.liveClass || item } });
      refetch();
    } catch (err) { toast.error(err.message); }
  }

  async function end(item) {
    if (!window.confirm("إنهاء الفصل لجميع المشاركين؟")) return;
    try { await api.post(`/teacher/live-classes/${item.id}/end`); toast.success("انتهى الفصل."); refetch(); }
    catch (err) { toast.error(err.message); }
  }

  async function cancel(item) {
    if (!window.confirm("إلغاء هذا الفصل؟")) return;
    try { await api.patch(`/teacher/live-classes/${item.id}/cancel`); toast.success("تم إلغاء الفصل."); refetch(); }
    catch (err) { toast.error(err.message); }
  }

  if (loading) return <LoadingState variant="list" label="جارِ تحميل الحصص المباشرة..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const now = Date.now();

  return <>
    <PageHeader title="الفصول المباشرة" description="أنشئ غرفة فيديو داخل TeacherHub، وابدأها عند الموعد. الحضور يتأكد من اتصال الطالب بالغرفة." actions={<Button icon={CalendarPlus} onClick={() => setOpen(true)}>جدولة فصل</Button>} />
    {classes.length === 0 ? <EmptyState illustration="book" title="لا توجد فصول مجدولة" message="أنشئ فصلًا واختر الكورس والطلاب الذين يمكنهم الانضمام." action={<Button icon={CalendarPlus} onClick={() => setOpen(true)}>جدولة أول فصل</Button>} /> : <ul className="grid lg:grid-cols-2 gap-4 stagger">
      {classes.map((item) => {
        const canStart = now >= new Date(item.startsAt).getTime() - 30 * 60_000;
        const ended = item.status === "ENDED" || !!item.endedAt;
        return <li key={item.id} className={`card p-4 sm:p-5 min-w-0 ${item.status === "CANCELLED" ? "opacity-70" : ""}`} style={{ borderInlineStartWidth: 4, borderInlineStartColor: STATUS_ACCENT[item.status] || "var(--line-strong)" }}>
          <div className="flex items-start gap-3"><span className="ct ct-primary ct-sm !rounded-full shrink-0"><Icon icon={Video} size={17} /></span><div className="min-w-0 flex-1">
            <h2 className="font-bold text-ink break-words">{item.title}</h2>
            {item.status === "LIVE" && <span className="badge badge-bad badge-dot mt-1.5">مباشر الآن</span>}
            <p className="text-sm text-ink-2 mt-1">{formatDate(item.startsAt)}{item.endsAt ? ` — ${formatDate(item.endsAt)}` : ""}</p>
            <p className="text-xs text-ink-3 mt-1">{item.course?.title || "فصل عام"}{item.lesson?.title ? ` · ${item.lesson.title}` : ""}</p>
            <p className="text-xs text-ink-3 mt-1">{VISIBILITY_LABELS[item.visibility] || "طلاب مؤهلون"}{item.grade ? ` · ${item.grade}` : ""}{item.group ? ` · ${item.group}` : ""}</p>
            {item.description && <p className="text-sm text-ink-2 mt-3 whitespace-pre-wrap break-words">{item.description}</p>}
          </div></div>
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-2"><Icon icon={Users} size={16} /> {item.attendanceCount ?? 0} حضور مؤكد</span>
            <div className="flex gap-2 flex-wrap justify-end">
              {item.status === "SCHEDULED" && <Button size="sm" icon={Play} disabled={!canStart} onClick={() => openRoom(item, true)}>{canStart ? "بدء الفصل" : "لم يحن وقت البدء"}</Button>}
              {item.status === "LIVE" && <><Button size="sm" icon={Video} onClick={() => openRoom(item)}>الانضمام للغرفة</Button><Button size="sm" variant="danger" icon={PhoneOff} onClick={() => end(item)}>إنهاء للجميع</Button></>}
              {item.status === "SCHEDULED" && <Button variant="danger" size="sm" icon={XCircle} onClick={() => cancel(item)}>إلغاء</Button>}
              {item.status === "CANCELLED" && <span className="text-sm text-bad font-semibold">ملغى</span>}
              {ended && <span className="inline-flex items-center gap-1 text-sm text-ink-3"><CheckCircle2 size={16} /> انتهى</span>}
            </div>
          </div>
          {item.attendance?.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer min-h-[44px] py-2 font-semibold text-ink-2">الحضور المؤكد ({item.attendanceCount})</summary><ul className="grid sm:grid-cols-2 gap-2">{item.attendance.map((attendance) => <li key={attendance.id} className="rounded bg-sunken px-3 py-2 text-ink">{attendance.student.fullName}</li>)}</ul></details>}
        </li>;
      })}
    </ul>}

    <Modal open={open} onClose={() => setOpen(false)} title="جدولة فصل مباشر" description="سيُنشأ فصل فيديو داخل TeacherHub عند البدء، دون روابط اجتماعات خارجية." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" form="live-class-form" loading={saving}>حفظ الفصل</Button></>}>
      <form id="live-class-form" onSubmit={create} className="space-y-4">
        <Input label="عنوان الفصل" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <Select label="الكورس (اختياري)" value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, lessonId: "" })}><option value="">فصل عام لطلابي</option>{(courseData?.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select>
        {form.courseId && <Select label="درس مرتبط (اختياري)" value={form.lessonId} onChange={(event) => setForm({ ...form, lessonId: event.target.value })}><option value="">بدون درس مرتبط</option>{(lessonData?.lessons || []).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</Select>}
        <Select label="الطلاب المسموح لهم" value={form.visibility} onChange={(event) => { setForm({ ...form, visibility: event.target.value }); setSelectedStudents([]); }}><option value="ALL_STUDENTS">كل الطلاب المؤهلين</option><option value="GRADE">مرحلة دراسية</option><option value="GROUP">مجموعة دراسية</option><option value="SPECIFIC_STUDENTS">طلاب محددون</option></Select>
        {(form.visibility === "GRADE" || form.visibility === "GROUP") && <Input label="المرحلة الدراسية" required maxLength={100} value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} />}
        {form.visibility === "GROUP" && <Input label="المجموعة" required maxLength={100} value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })} />}
        {form.visibility === "SPECIFIC_STUDENTS" && <section className="rounded-lg border border-line p-3" aria-label="اختيار الطلاب">
          <label className="relative block"><span className="sr-only">ابحث عن طالب</span><Search size={17} className="absolute start-3 top-3 text-ink-3" aria-hidden="true" /><input className="form-input ps-10" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="ابحث عن طالب" /></label>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">{visibleStudents.map((student) => <label key={student.id} className="flex min-h-[44px] items-center gap-2 rounded px-2 hover:bg-sunken"><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={(event) => setSelectedStudents((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} className="h-4 w-4 accent-primary-600" /><span className="text-sm">{student.fullName}</span></label>)}</div>
          <p className="mt-2 text-xs text-ink-3">المحددون: {selectedStudents.length}. القائمة تعرض أول 100 طالب مملوك لحسابك.</p>
        </section>}
        <div className="grid sm:grid-cols-2 gap-3"><Input label="موعد البدء" type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /><Input label="موعد الانتهاء (اختياري)" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></div>
        <Textarea label="ملاحظات (اختياري)" rows={3} maxLength={3000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </form>
    </Modal>
  </>;
}
