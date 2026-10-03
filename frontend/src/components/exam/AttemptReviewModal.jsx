import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState } from "../common/StateViews";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { Input, Textarea } from "../ui/Form";
import api from "../../services/api";

const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const hasText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * One student's attempt, question by question: what they answered, what the
 * right answer was, and — for essay questions — a box where the teacher decides
 * how many marks the answer deserves. Saving sends the final score to the student.
 */
export default function AttemptReviewModal({ attemptId, onClose, onSaved }) {
  const { data, loading, error, refetch } = useApi(`/teacher/exams/attempts/${attemptId}`);
  const [points, setPoints] = useState({}); // answerId -> string
  const [notes, setNotes] = useState({});   // answerId -> string
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = {};
    const n = {};
    data.questions.forEach((q) => {
      if (q.answerId) {
        p[q.answerId] = q.pointsAwarded ?? "";
        n[q.answerId] = q.teacherFeedback ?? "";
      }
    });
    setPoints(p);
    setNotes(n);
  }, [data]);

  const gradable = data ? data.questions.filter((q) => q.type === "ESSAY" && q.answerId && hasText(q.essayText)) : [];
  const waiting = gradable.filter((q) => points[q.answerId] === "" || points[q.answerId] == null).length;

  async function handleSave() {
    const grades = [];
    for (const q of gradable) {
      const raw = points[q.answerId];
      if (raw === "" || raw == null) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > q.points) {
        return toast.error(`الدرجة لازم تكون بين 0 و ${q.points}`);
      }
      grades.push({ answerId: q.answerId, pointsAwarded: value, teacherFeedback: notes[q.answerId] || null });
    }
    if (grades.length === 0) return toast.error("اكتب درجة سؤال واحد على الأقل");

    setSaving(true);
    try {
      const res = await api.patch(`/teacher/exams/attempts/${attemptId}/grade`, { grades });
      toast.success(res.data.finalized ? "تم حفظ الدرجات وإرسال النتيجة للطالب" : "تم حفظ الدرجات، لسه فيه أسئلة ما اتصححتش");
      await refetch();
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const a = data?.attempt;
  const status = !a ? null : a.status === "GRADED"
    ? (a.passed === true ? <Badge tone="ok" icon={CheckCircle2}>ناجح</Badge> : a.passed === false ? <Badge tone="bad">راسب</Badge> : <Badge tone="ok" icon={CheckCircle2}>تم التصحيح</Badge>)
    : <Badge tone="warn">بانتظار تصحيحك</Badge>;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={data ? `إجابات ${data.student.fullName}` : "جارِ التحميل..."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إغلاق</Button>
          {gradable.length > 0 && <Button icon={Send} onClick={handleSave} loading={saving}>{saving ? "جارِ الحفظ..." : "حفظ الدرجات وإرسالها للطالب"}</Button>}
        </>
      }
    >
      {loading && !data && <LoadingState variant="list" rows={3} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && (
        <div className="space-y-5">
          <div className="panel p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="font-bold text-ink">{data.exam.title}</span>
            <span className="text-ink-3 num">المحاولة {a.attemptNumber}</span>
            {status}
            <span className="ms-auto num font-bold text-ink" dir="ltr">
              {a.status === "GRADED" ? `${a.score} / ${a.maxScore}` : "الدرجة بعد التصحيح"}
            </span>
          </div>
          {data.exam.passingScore != null && <p className="text-xs text-ink-3 -mt-2 num">درجة النجاح: {data.exam.passingScore}</p>}
          {waiting > 0 && <p className="text-sm text-warn font-semibold">فيه {waiting} سؤال مقالي محتاج درجة.</p>}

          <ol className="space-y-3">
            {data.questions.map((q, i) => (
              <li key={q.id} className="panel p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-primary-soft text-primary-ink font-bold text-sm num shrink-0">{i + 1}</span>
                  <p className="flex-1 min-w-0 font-semibold text-ink whitespace-pre-wrap">{q.text}</p>
                  <span className="text-xs text-ink-3 num shrink-0">{q.points} {q.points === 1 ? "درجة" : "درجات"}</span>
                </div>

                {q.type === "MULTIPLE_CHOICE" ? (
                  <ul className="space-y-1.5">
                    {q.options.map((o, oi) => {
                      const chosen = o.id === q.selectedOptionId;
                      const right = o.id === q.correctOptionId;
                      return (
                        <li key={o.id} className={`flex items-center gap-2.5 rounded px-3 py-2 text-sm ${right ? "bg-ok-bg text-ok" : chosen ? "bg-bad-bg text-bad" : "bg-sunken text-ink-2"}`}>
                          <span className="font-bold w-5 shrink-0">{LETTERS[oi] || oi + 1}</span>
                          <span className="flex-1 min-w-0">{o.text}</span>
                          {chosen && <span className="text-xs font-semibold shrink-0">إجابة الطالب</span>}
                          {right && <Icon icon={CheckCircle2} size={16} className="shrink-0" />}
                          {chosen && !right && <Icon icon={XCircle} size={16} className="shrink-0" />}
                        </li>
                      );
                    })}
                    {!q.selectedOptionId && <li className="text-xs text-warn font-semibold">الطالب لم يجب على هذا السؤال.</li>}
                  </ul>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-ink-3 mb-1">إجابة الطالب</p>
                      <p className="rounded bg-sunken p-3 text-sm whitespace-pre-wrap text-ink-2">{hasText(q.essayText) ? q.essayText : "لم يُجب"}</p>
                    </div>
                    {q.answerId && hasText(q.essayText) && (
                      <div className="grid sm:grid-cols-[140px_1fr] gap-3">
                        <Input
                          label={`الدرجة (من ${q.points})`} type="number" step="0.5" min="0" max={q.points} inputMode="decimal"
                          value={points[q.answerId] ?? ""} onChange={(e) => setPoints((p) => ({ ...p, [q.answerId]: e.target.value }))}
                        />
                        <Textarea label="ملاحظة للطالب" hint="اختياري" rows={2} value={notes[q.answerId] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [q.answerId]: e.target.value }))} />
                      </div>
                    )}
                    {!hasText(q.essayText) && <p className="text-xs text-ink-3">سؤال متسابش فاضي، درجته 0 تلقائيًا.</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
