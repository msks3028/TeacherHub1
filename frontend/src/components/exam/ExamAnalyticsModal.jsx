import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../common/StateViews";
import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import StatStrip from "../ui/StatStrip";
import { BarChart } from "../ui/Charts";
import { ProgressBar, ProgressRing } from "../ui/Progress";
import AttemptReviewModal from "./AttemptReviewModal";
import { fmtNumber, percent } from "../../lib/format";

const BUCKETS = [
  { label: "0–20", min: 0, max: 20, color: "var(--bad-solid)" },
  { label: "20–40", min: 20, max: 40, color: "var(--warn-solid)" },
  { label: "40–60", min: 40, max: 60, color: "var(--warn-solid)" },
  { label: "60–80", min: 60, max: 80, color: "var(--ok-solid)" },
  { label: "80–100", min: 80, max: 101, color: "var(--ok-solid)" },
];

/** ناجح / راسب / تم التصحيح / بانتظار التصحيح — one meaning per state, same as the student sees. */
function StatusBadge({ r }) {
  if (r.status !== "GRADED") return <Badge tone="warn">بانتظار تصحيحك</Badge>;
  if (r.passed === true) return <Badge tone="ok">ناجح</Badge>;
  if (r.passed === false) return <Badge tone="bad">راسب</Badge>;
  return <Badge tone="ok">تم التصحيح</Badge>; // no passing score was set for this exam
}

export default function ExamAnalyticsModal({ examId, onClose }) {
  const { data, loading, error, refetch } = useApi(`/teacher/exams/${examId}/analytics`);
  const [reviewId, setReviewId] = useState(null);

  const graded = data ? data.results.filter((r) => r.status === "GRADED" && r.score != null && r.maxScore > 0) : [];
  const dist = BUCKETS.map((b) => ({ label: b.label, color: b.color, value: graded.filter((r) => { const p = percent(r.score, r.maxScore); return p >= b.min && p < b.max; }).length }));
  const decided = graded.filter((r) => r.passed !== null);
  const passed = decided.filter((r) => r.passed).length;
  const passRate = data?.passRate != null ? Math.round(data.passRate) : null;
  const multiAttempts = data ? data.results.some((r) => r.attemptNumber > 1) : false;

  return (
    <>
      <Modal open onClose={onClose} title="تحليلات الاختبار" size="xl">
        {loading && !data && <LoadingState variant="stats" rows={6} />}
        {error && <ErrorState message={error} />}
        {data && (
          <div className="space-y-7">
            <StatStrip items={[
              { label: "مُكلّفون", value: data.totalAssigned, tone: "primary" },
              { label: "أكملوا", value: data.completed, tone: "ok" },
              { label: "لم يدخلوا", value: data.notAttempted, tone: "warn" },
            ]} />
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[["المتوسط", data.averageScore != null ? data.averageScore.toFixed(1) : "-"], ["أعلى درجة", data.highestScore ?? "-"], ["أقل درجة", data.lowestScore ?? "-"]].map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse rounded-2xl bg-sunken py-3"><dt className="mt-1 text-xs text-ink-3">{label}</dt><dd className="num font-display text-xl font-bold text-ink">{value}</dd></div>
              ))}
            </dl>

            {graded.length > 0 && (
              <div className="grid md:grid-cols-[1fr_220px] gap-6 items-center">
                <section aria-label="توزيع الدرجات">
                  <h3 className="text-sm font-bold text-ink-2 mb-3">توزيع الدرجات (نسبة مئوية)</h3>
                  <BarChart data={dist} ariaLabel="توزيع درجات الطلاب على خمس شرائح" />
                </section>
                <section aria-label="نسبة النجاح" className="flex flex-col items-center text-center">
                  {passRate !== null ? (
                    <>
                      <ProgressRing value={passRate} size={120} stroke={11} tone={passRate >= 50 ? "ok" : "warn"} label={`نسبة النجاح ${passRate}%`}>
                        <span className="num text-2xl font-bold text-ink">{passRate}%</span>
                      </ProgressRing>
                      <p className="mt-2 text-sm font-semibold text-ink">نسبة النجاح</p>
                      <p className="text-xs text-ink-3 num">{fmtNumber(passed)} من {fmtNumber(decided.length)} طالب</p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-3">لم تُحدَّد درجة نجاح لهذا الاختبار، فمفيش ناجح أو راسب. الدرجات ظاهرة للطلاب كما هي.</p>
                  )}
                </section>
              </div>
            )}

            {data.results.length === 0 ? (
              <EmptyState compact illustration="file" message="لسه ما فيش نتائج." />
            ) : (
              <section aria-label="نتائج الطلاب">
                <h3 className="text-sm font-bold text-ink-2 mb-3">أداء الطلاب</h3>
                <ul className="grid gap-3 md:grid-cols-2 stagger">
                  {data.results.map((r) => {
                    const pct = r.score != null && r.maxScore > 0 ? percent(r.score, r.maxScore) : null;
                    return (
                      <li key={r.attemptId} className="card p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.studentName} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-ink">{r.studentName}{multiAttempts && <span className="text-ink-3 text-xs font-medium num"> · محاولة {r.attemptNumber}</span>}</p>
                            <p className="num text-sm text-ink-2" dir="ltr">{r.score ?? "-"} / {r.maxScore ?? "-"}</p>
                          </div>
                          <StatusBadge r={r} />
                        </div>
                        {pct !== null && (
                          <div className="mt-3 flex items-center gap-3">
                            <ProgressBar value={pct} tone={r.passed === false ? "warn" : "ok"} label={`${pct}%`} className="flex-1" />
                            <span className="num w-11 text-end text-sm font-bold text-ink-2">{pct}%</span>
                          </div>
                        )}
                        <Button variant="soft" size="sm" icon={ClipboardCheck} className="mt-3 w-full" onClick={() => setReviewId(r.attemptId)}>
                          {r.status === "GRADED" ? "مراجعة الإجابات" : "تصحيح"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </Modal>
      {reviewId && <AttemptReviewModal attemptId={reviewId} onClose={() => setReviewId(null)} onSaved={refetch} />}
    </>
  );
}
