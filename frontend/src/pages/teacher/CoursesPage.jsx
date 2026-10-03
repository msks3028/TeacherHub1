import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { BookOpen, ClipboardList, GraduationCap, ListChecks, Plus, PlayCircle, Users } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Alert from "../../components/ui/Alert";
import Cover from "../../components/ui/Cover";
import Icon, { ChevronForward } from "../../components/ui/Icon";
import CountUp from "../../components/ui/CountUp";
import PageHeader from "../../components/ui/PageHeader";
import GradeSelect from "../../components/ui/GradeSelect";
import { ChoiceGroup, Input, Textarea } from "../../components/ui/Form";
import ImageUpload from "../../components/ui/ImageUpload";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/api";
import { fmtNumber } from "../../lib/format";

export default function CoursesPage() {
  const { data, loading, error, refetch } = useApi("/teacher/courses");
  const { data: studentsData } = useApi("/teacher/students");
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", group: "" });
  const [enrollMode, setEnrollMode] = useState("ALL"); // "ALL" | "GRADE"
  const [grade, setGrade] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const matchingCount =
    studentsData &&
    (enrollMode === "ALL"
      ? studentsData.students.length
      : studentsData.students.filter((s) => s.grade === grade).length);

  async function handleCreate(e) {
    e.preventDefault();
    if (enrollMode === "GRADE" && !grade) return toast.error("اختر الصف أولًا");

    const studentIds =
      enrollMode === "ALL"
        ? studentsData?.students.map((s) => s.id) || []
        : studentsData?.students.filter((s) => s.grade === grade).map((s) => s.id) || [];

    if (studentIds.length === 0) {
      const proceed = await confirm({
        title: "مفيش طلاب مطابقين",
        message: "لا يوجد طلاب مطابقين حاليًا — الكورس لن يظهر لأي أحد إلى أن يتوفر طلاب. متابعة؟",
        confirmLabel: "متابعة",
        danger: false,
      });
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      await api.post("/teacher/courses", { ...form, imageUrl: imageUrl || undefined, grade: enrollMode === "GRADE" ? grade : "", studentIds });
      toast.success(`تم إنشاء الكورس وتسجيل ${studentIds.length} طالب فيه`);
      setOpen(false);
      setForm({ title: "", description: "", group: "" });
      setEnrollMode("ALL");
      setGrade("");
      setImageUrl("");
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="الكورسات" description="نظّم محتواك في كورسات، وحدّد مين يشوفها." actions={<Button icon={Plus} onClick={() => setOpen(true)}>كورس جديد</Button>} />

      {loading && !data && <LoadingState variant="grid" rows={6} label="جارِ تحميل الكورسات..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && !error && data.courses.length === 0 && (
        <EmptyState illustration="book" title="لسه ما عملتش كورسات" message="ابدأ بكورس واختار الطلاب اللي هيتسجّلوا فيه." action={<Button icon={Plus} onClick={() => setOpen(true)}>كورس جديد</Button>} />
      )}

      {data && !error && data.courses.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {data.courses.map((c) => (
            <Link key={c.id} to={`/teacher/courses/${c.id}`} className="group card card-interactive overflow-hidden flex flex-col">
              <Cover seed={c.title + c.id} src={c.imageUrl} icon={BookOpen} />
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-ink text-lg leading-snug">{c.title}</h3>
                  {c._count.enrollments === 0 && <Badge tone="bad" className="shrink-0">محدش مسجّل</Badge>}
                </div>
                {c.description && <p className="text-sm text-ink-2 mt-1 line-clamp-2">{c.description}</p>}
                {c.grade && <p className="mt-2"><Badge icon={GraduationCap}>{c.grade}</Badge></p>}
                <div className="mt-auto pt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    [Users, "text-primary-ink", c._count.enrollments, "طالب"],
                    [PlayCircle, "text-video", c._count.videos, "فيديو"],
                    [ClipboardList, "text-homework", c._count.homework, "واجب"],
                    [ListChecks, "text-exam", c._count.exams, "اختبار"],
                  ].map(([ic, tone, n, label]) => (
                    <div key={label} className="rounded-xl bg-sunken px-1 py-2">
                      <p className="num text-base font-bold leading-none text-ink"><CountUp value={n} format={fmtNumber} /></p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-3"><Icon icon={ic} size={14} className={tone} />{label}</p>
                    </div>
                  ))}
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-ink">
                  إدارة الكورس <Icon icon={ChevronForward} size={16} className="transition-transform duration-200 group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إنشاء كورس جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" form="create-course" loading={submitting}>{submitting ? "جارِ الإنشاء..." : "إنشاء الكورس"}</Button>
          </>
        }
      >
        <form id="create-course" onSubmit={handleCreate} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">عن الكورس</legend>
            <Input label="اسم الكورس" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea label="الوصف" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <ImageUpload label="صورة الكورس (اختياري)" hint="بتظهر على كارت الكورس للطلاب" value={imageUrl} onChange={setImageUrl} disabled={submitting} />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">مين هيتسجّل؟</legend>
            <ChoiceGroup columns={2} value={enrollMode} onChange={setEnrollMode}
              options={[{ value: "ALL", label: "كل الطلاب", icon: Users }, { value: "GRADE", label: "صف معيّن فقط", icon: GraduationCap }]} />
            {enrollMode === "GRADE" && <GradeSelect required value={grade} onChange={setGrade} />}
            <Input label="اسم المجموعة" hint="اختياري، للتوصيف فقط" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
          </fieldset>

          {studentsData ? (
            <Alert tone={matchingCount === 0 ? "warn" : "info"}>
              {matchingCount === 0
                ? "مفيش طلاب مطابقين حاليًا، الكورس مش هيظهر لأي حد لحد ما تضيف طلاب."
                : <>سيتم تسجيل <span className="num font-bold">{fmtNumber(matchingCount)}</span> طالب في هذا الكورس تلقائيًا.</>}
            </Alert>
          ) : (
            <p className="hint">جارِ حساب عدد الطلاب...</p>
          )}
        </form>
      </Modal>
    </>
  );
}
