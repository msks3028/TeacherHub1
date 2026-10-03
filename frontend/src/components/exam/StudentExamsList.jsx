import { useState } from "react";
import { CheckCircle2, FileQuestion, Hourglass, Play, RotateCcw } from "lucide-react";
import { EmptyState } from "../common/StateViews";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { ScoreMark } from "../ui/Progress";
import { useConfirm } from "../../context/ConfirmContext";
import ExamTakingScreen from "./ExamTakingScreen";
import { fmtDateTime } from "../../lib/format";

function Stat({ value, label }) {
  return (
    <div className="rounded-xl bg-sunken py-2.5 text-center">
      <p className="num text-lg font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

/**
 * Full exam list with start/continue capability — shared between the
 * standalone "الاختبارات" page and a course's own Exams tab.
 */
export default function StudentExamsList({ exams, onChanged, emptyMessage = "لا يوجد اختبارات متاحة حاليًا." }) {
  const [activeExamId, setActiveExamId] = useState(null);
  const confirm = useConfirm();

  if (activeExamId) {
    return <ExamTakingScreen examId={activeExamId} onExit={() => { setActiveExamId(null); onChanged(); }} />;
  }

  if (exams.length === 0) return <EmptyState illustration="check" title="مفيش اختبارات" message={emptyMessage} />;

  async function start(ex) {
    const ok = await confirm({
      title: `تبدأ "${ex.title}"؟`,
      message: ex.durationMinutes
        ? `مدة الاختبار ${ex.durationMinutes} دقيقة والوقت بيبدأ فورًا ومش بيقف لو خرجت. جهّز نفسك واتأكد من اتصال الإنترنت.`
        : "الاختبار بيبدأ فورًا. جهّز نفسك واتأكد من اتصال الإنترنت.",
      confirmLabel: "ابدأ الآن",
      danger: false,
    });
    if (ok) setActiveExamId(ex.id);
  }

  return (
    <ul className="space-y-3 stagger">
      {exams.map((ex) => {
        const myAttempts = ex.myAttempts || [];
        // the latest graded attempt is the one whose result is shown
        const graded = [...myAttempts].filter((a) => a.status === "GRADED").sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
        const inProgress = myAttempts.find((a) => a.status === "IN_PROGRESS");
        const waiting = myAttempts.find((a) => a.status === "SUBMITTED"); // sent to the teacher, not marked yet
        const left = ex.maxAttempts - myAttempts.length;
        const canStart = !inProgress && left > 0;
        return (
          <li key={ex.id} className="card overflow-hidden">
            <div className="flex items-start gap-3.5 p-4 md:p-5" style={{ background: "var(--t-exam-bg)" }}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-raised" style={{ color: "var(--t-exam)" }} aria-hidden="true"><Icon icon={FileQuestion} size={24} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ink leading-snug">{ex.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {inProgress ? <Badge tone="warn" dot>جارٍ الآن</Badge>
                  : graded ? (
                    graded.passed === true ? <Badge tone="ok" icon={CheckCircle2}>ناجح</Badge>
                    : graded.passed === false ? <Badge tone="bad">راسب</Badge>
                    : <Badge tone="ok" icon={CheckCircle2}>اتصحّح</Badge>
                  ) : waiting ? <Badge tone="info" icon={Hourglass}>بانتظار تصحيح المدرس</Badge>
                  : myAttempts.length === 0 ? <Badge tone="primary">أول محاولة</Badge>
                  : <Badge>خلّصت المحاولات</Badge>}
                  {graded && waiting && <Badge tone="info" icon={Hourglass}>محاولة بانتظار التصحيح</Badge>}
                </div>
              </div>
              {graded && <ScoreMark score={graded.score} max={graded.maxScore} className="hidden sm:grid" />}
            </div>

            <div className="p-4 md:p-5">
              {graded && <div className="sm:hidden mb-4 flex justify-center"><ScoreMark score={graded.score} max={graded.maxScore} /></div>}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat value={ex._count.questions} label="سؤال" />
                <Stat value={ex.durationMinutes || "-"} label={ex.durationMinutes ? "دقيقة" : "بدون وقت"} />
                <Stat value={ex.maxAttempts} label="محاولات مسموحة" />
                <Stat value={Math.max(left, 0)} label="متبقّي" />
              </div>
              {ex.endDate ? <p className="mt-3 text-xs text-ink-3 num">آخر موعد: {fmtDateTime(ex.endDate)}</p> : null}
              {waiting && !graded && <p className="mt-3 text-sm text-ink-2">إجاباتك وصلت للمدرس، ودرجتك هتظهر هنا أول ما يصحّحها.</p>}

              {(inProgress || canStart) && (
                <div className="mt-4">
                  {inProgress ? (
                    <Button onClick={() => setActiveExamId(ex.id)} icon={RotateCcw} className="w-full sm:w-auto">متابعة الاختبار</Button>
                  ) : (
                    <Button onClick={() => start(ex)} icon={Play} variant={myAttempts.length ? "secondary" : "primary"} className="w-full sm:w-auto">
                      {myAttempts.length ? `محاولة جديدة (متبقّي ${left})` : "بدء الاختبار"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
