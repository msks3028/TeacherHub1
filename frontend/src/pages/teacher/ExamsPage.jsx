import { useState } from "react";
import toast from "react-hot-toast";
import { BarChart3, ListChecks, PenLine, Plus } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import Icon from "../../components/ui/Icon";
import CountUp from "../../components/ui/CountUp";
import { Input, Textarea } from "../../components/ui/Form";
import ExamFormModal from "../../components/exam/ExamFormModal";
import ExamAnalyticsModal from "../../components/exam/ExamAnalyticsModal";
import api from "../../services/api";
import { fmtNumber } from "../../lib/format";

export default function ExamsPage() {
  const { data, loading, error, refetch } = useApi("/teacher/exams");
  const [open, setOpen] = useState(false);
  const [analyticsExamId, setAnalyticsExamId] = useState(null);
  const [gradingOpen, setGradingOpen] = useState(false);

  if (loading && !data) return <LoadingState variant="list" label="جارِ تحميل الاختبارات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="الاختبارات"
        description="الاختبارات العامة واختبارات كل الكورسات في مكان واحد. تقدر كمان تنشئ اختبار من داخل صفحة الكورس."
        actions={
          <>
            <Button variant="secondary" icon={PenLine} onClick={() => setGradingOpen(true)}>تصحيح الأسئلة المقالية</Button>
            <Button icon={Plus} onClick={() => setOpen(true)}>اختبار جديد</Button>
          </>
        }
      />

      {data.exams.length === 0 ? (
        <EmptyState illustration="check" title="لسه مفيش اختبارات" message="أنشئ أول اختبار بأسئلة اختيار من متعدد أو مقالية." action={<Button icon={Plus} onClick={() => setOpen(true)}>اختبار جديد</Button>} />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {data.exams.map((ex) => (
            <li key={ex.id} className="card card-interactive overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 p-4" style={{ background: "var(--t-exam-bg)" }}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-raised" style={{ color: "var(--t-exam)" }} aria-hidden="true"><Icon icon={ListChecks} size={24} /></span>
                <div className="min-w-0">
                  <h3 className="font-bold text-ink leading-snug break-words">{ex.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-2">{ex.course?.title || "اختبار عام"}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-sunken py-2.5">
                    <p className="num text-xl font-bold leading-none text-ink"><CountUp value={ex._count.questions} format={fmtNumber} /></p>
                    <p className="mt-1.5 text-[11px] text-ink-3">سؤال</p>
                  </div>
                  <div className="rounded-xl bg-sunken py-2.5">
                    <p className="num text-xl font-bold leading-none text-ink"><CountUp value={ex._count.attempts} format={fmtNumber} /></p>
                    <p className="mt-1.5 text-[11px] text-ink-3">محاولة</p>
                  </div>
                </div>
                <Button variant="soft" size="sm" icon={BarChart3} className="mt-auto w-full" onClick={() => setAnalyticsExamId(ex.id)}>التحليلات والنتائج</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ExamFormModal open={open} onClose={() => setOpen(false)} onCreated={refetch} />
      {analyticsExamId && <ExamAnalyticsModal examId={analyticsExamId} onClose={() => setAnalyticsExamId(null)} />}
      {gradingOpen && <EssayGradingModal onClose={() => setGradingOpen(false)} onGraded={refetch} />}
    </>
  );
}

function EssayGradingModal({ onClose, onGraded }) {
  const { data, loading, error, refetch } = useApi("/teacher/exams/essays-to-grade");
  const [grading, setGrading] = useState(null);
  const [points, setPoints] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleGrade(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/teacher/exams/answers/${grading.id}/grade`, { pointsAwarded: Number(points), teacherFeedback: feedback });
      toast.success("تم حفظ الدرجة");
      setGrading(null);
      refetch();
      onGraded?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="أسئلة مقالية بانتظار التصحيح" wide>
      {loading && !data && <LoadingState variant="list" rows={3} />}
      {error && <ErrorState message={error} />}
      {data && data.answers.length === 0 && <EmptyState compact illustration="check" title="كله متصحّح" message="لا يوجد أسئلة تحتاج تصحيح حاليًا." />}
      {data && data.answers.length > 0 && (
        <ul className="space-y-3">
          {data.answers.map((a) => (
            <li key={a.id} className="panel p-4">
              <p className="text-xs text-ink-3">{a.attempt.student.fullName} · {a.attempt.exam.title}</p>
              <p className="font-semibold text-ink mt-1">{a.question.text}</p>
              <p className="text-sm mt-2.5 rounded bg-sunken p-3 whitespace-pre-wrap text-ink-2">{a.essayText || "لم يُجب"}</p>
              <div className="flex items-center justify-between gap-3 mt-3">
                <span className="text-xs text-ink-3 num">الدرجة القصوى: {a.question.points}</span>
                <Button variant="soft" size="sm" onClick={() => { setGrading(a); setPoints(""); setFeedback(""); }}>تصحيح</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {grading && (
        <Modal open onClose={() => setGrading(null)} title="وضع الدرجة"
          footer={<><Button variant="secondary" onClick={() => setGrading(null)}>إلغاء</Button><Button type="submit" form="grade-essay" loading={submitting}>{submitting ? "جارِ الحفظ..." : "حفظ الدرجة"}</Button></>}>
          <form id="grade-essay" onSubmit={handleGrade} className="space-y-4">
            <Input required label={`الدرجة (من ${grading.question.points})`} type="number" step="0.5" inputMode="decimal" min="0" value={points} onChange={(e) => setPoints(e.target.value)} />
            <Textarea label="ملاحظات" hint="اختياري" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </form>
        </Modal>
      )}
    </Modal>
  );
}
