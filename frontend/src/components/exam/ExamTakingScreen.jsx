import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CheckCircle2, CloudOff, Flag, LayoutGrid, Loader2, Timer } from "lucide-react";
import { LoadingState } from "../common/StateViews";
import Button from "../ui/Button";
import Icon, { ArrowBack, ArrowForward } from "../ui/Icon";
import Modal from "../ui/Modal";
import { Textarea } from "../ui/Form";
import api from "../../services/api";

const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const pad = (n) => String(n).padStart(2, "0");

/** Focus mode: one question per screen, a steady timer, and a way to jump around. */
export default function ExamTakingScreen({ examId, onExit }) {
  const [attempt, setAttempt] = useState(null); // { attemptId, questions, durationMinutes }
  const [answers, setAnswers] = useState({}); // questionId -> { selectedOptionId?, essayText? }
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [navOpen, setNavOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const submittedRef = useRef(false);
  const pending = useRef(0);
  // Always the newest answers, readable from any callback (the submit button and
  // the timer's auto-submit both need the LATEST text, not a stale copy).
  const answersRef = useRef({});
  const essayTimers = useRef({});
  // React 18 StrictMode runs effects twice in development, which would send
  // two simultaneous "start" requests. Remember which exam we already started.
  const startedForRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => () => Object.values(essayTimers.current).forEach(clearTimeout), []);

  // Full-screen focus mode: lock the page behind it and move focus inside.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    if (!loading) rootRef.current?.focus({ preventScroll: true });
  }, [loading]);

  useEffect(() => {
    if (startedForRef.current === examId) return;
    startedForRef.current = examId;
    (async () => {
      try {
        const { data } = await api.post(`/student/exams/${examId}/start`);
        setAttempt(data);
        // The server tells us how much time is really left (so a page refresh can't
        // reset the timer); fall back to the full duration for older responses.
        if (data.remainingSeconds != null) setSecondsLeft(data.remainingSeconds);
        else if (data.durationMinutes) setSecondsLeft(data.durationMinutes * 60);
      } catch (err) {
        toast.error(err.message);
        onExit();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current || !attempt) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      // Everything the student answered goes together with "submit", so the
      // result never depends on a background save that might still be running.
      Object.values(essayTimers.current).forEach(clearTimeout);
      const answersPayload = Object.entries(answersRef.current).map(([questionId, a]) => ({ questionId, ...a }));
      const { data } = await api.post(`/student/exams/attempts/${attempt.attemptId}/submit`, { answers: answersPayload });
      toast.success(data?.needsGrading ? "تم إرسال إجاباتك للمدرس، ودرجتك هتظهر بعد ما يصحّحها" : "تم تسليم الاختبار");
      onExit();
    } catch (err) {
      toast.error(err.message);
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      handleSubmit(); // auto-submit when time is up
      return;
    }
    if (secondsLeft === 300) setAnnounce("باقي 5 دقائق");
    if (secondsLeft === 60) setAnnounce("باقي دقيقة واحدة");
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, handleSubmit]);

  async function persist(questionId, patch) {
    pending.current += 1;
    setSaveState("saving");
    try {
      // Saved as the student works so nothing is lost on a dropped connection.
      await api.post(`/student/exams/attempts/${attempt.attemptId}/answer`, { questionId, ...patch });
      pending.current -= 1;
      if (pending.current === 0) setSaveState("saved");
    } catch {
      /* the local state still holds the answer; it is sent again with "submit" */
      pending.current -= 1;
      setSaveState("error");
    }
  }

  function saveAnswer(questionId, patch) {
    const next = { ...answersRef.current[questionId], ...patch };
    answersRef.current = { ...answersRef.current, [questionId]: next };
    setAnswers(answersRef.current);

    if ("essayText" in patch) {
      // Essays are typed letter by letter — save once the student pauses, not on every key.
      clearTimeout(essayTimers.current[questionId]);
      setSaveState("saving");
      essayTimers.current[questionId] = setTimeout(() => persist(questionId, patch), 700);
    } else {
      persist(questionId, patch);
    }
  }

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-surface overflow-y-auto p-6"><div className="max-w-2xl mx-auto"><LoadingState label="جارِ تجهيز الاختبار..." /></div></div>,
      document.body
    );
  }
  if (!attempt) return null;

  const total = attempt.questions.length;
  const question = attempt.questions[current];
  const isAnswered = (q) => {
    const a = answers[q.id];
    return q.type === "MULTIPLE_CHOICE" ? !!a?.selectedOptionId : !!a?.essayText?.trim();
  };
  const answeredCount = attempt.questions.filter(isAnswered).length;
  const unanswered = attempt.questions.map((q, i) => ({ q, i })).filter(({ q }) => !isAnswered(q));

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : null;
  const timerTone = secondsLeft === null ? "" : secondsLeft <= 60 ? "bg-bad-bg text-bad timer-urgent" : secondsLeft <= 300 ? "bg-warn-bg text-warn" : "bg-sunken text-ink";

  const Navigator = ({ onPick }) => (
    <div>
      <div className="grid grid-cols-5 gap-2" role="list">
        {attempt.questions.map((q, i) => {
          const ans = isAnswered(q);
          const cur = i === current;
          return (
            <button
              key={q.id}
              type="button"
              role="listitem"
              onClick={() => { setCurrent(i); onPick?.(); }}
              aria-current={cur ? "step" : undefined}
              aria-label={`سؤال ${i + 1}، ${ans ? "تمت الإجابة" : "لم تتم الإجابة"}`}
              className={`num min-h-[44px] rounded font-bold text-sm border transition-colors ${
                cur ? "bg-primary text-primary-on border-primary" : ans ? "bg-ok-bg text-ok border-transparent" : "bg-raised text-ink-2 border-line-strong hover:bg-sunken"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-3">
        <li className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary" />الحالي</li>
        <li className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-ok-bg border border-ok" />تمت الإجابة</li>
        <li className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-line-strong" />لسه</li>
      </ul>
    </div>
  );

  return createPortal(
    <div ref={rootRef} tabIndex={-1} className="fixed inset-0 z-[60] bg-surface flex flex-col outline-none" role="region" aria-label="الاختبار">
      <p className="sr-only" aria-live="assertive">{announce}</p>

      {/* header: progress + timer stay put */}
      <header className="bg-raised border-b border-line shrink-0 safe-t">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-3">وضع الاختبار</p>
            <h2 className="font-bold text-ink num">سؤال {current + 1} من {total}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={LayoutGrid} onClick={() => setNavOpen(true)} className="lg:hidden">
              الأسئلة <span className="num">({answeredCount}/{total})</span>
            </Button>
            {secondsLeft !== null && (
              <span className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-full font-bold num text-base ${timerTone}`} role="timer" aria-label={`الوقت المتبقي ${minutes} دقيقة و ${seconds} ثانية`} dir="ltr">
                <Icon icon={Timer} size={20} />
                {pad(minutes)}:{pad(seconds)}
              </span>
            )}
          </div>
        </div>
        <div className="h-1 bg-sunken" role="progressbar" aria-label="الأسئلة المجاب عنها" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount}>
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[1fr_260px] lg:gap-8 lg:items-start">
          <main key={question.id} className="anim-rise min-w-0">
            <div className="panel p-5 md:p-7">
              <div className="flex items-start justify-between gap-3">
                <span className="badge badge-primary">{question.type === "MULTIPLE_CHOICE" ? "اختيار من متعدد" : "سؤال مقالي"}</span>
                {question.points != null && <span className="text-xs text-ink-3 num">{question.points} {question.points === 1 ? "درجة" : "درجات"}</span>}
              </div>
              <p className="mt-4 text-lg md:text-xl font-semibold text-ink leading-relaxed whitespace-pre-wrap">{question.text}</p>

              <div className="mt-6">
                {question.type === "MULTIPLE_CHOICE" ? (
                  <div className="space-y-3" role="radiogroup" aria-label="الاختيارات">
                    {question.options.map((opt, oi) => (
                      <label key={opt.id} className="block cursor-pointer">
                        <input
                          type="radio"
                          name={question.id}
                          className="sr-only peer"
                          checked={answers[question.id]?.selectedOptionId === opt.id}
                          onChange={() => saveAnswer(question.id, { selectedOptionId: opt.id })}
                        />
                        <span className="flex items-center gap-3.5 min-h-[56px] px-4 py-3 rounded border border-line-field bg-raised transition-colors hover:bg-sunken peer-checked:border-primary-ink peer-checked:bg-primary-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)] peer-checked:[&>span:first-child]:bg-primary peer-checked:[&>span:first-child]:text-primary-on peer-checked:[&>span:first-child]:border-primary">
                          <span className="grid place-items-center w-8 h-8 rounded-full border border-line-field text-sm font-bold text-ink-2 shrink-0 transition-colors">{LETTERS[oi] || oi + 1}</span>
                          <span className="text-base text-ink">{opt.text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>
                    <Textarea aria-label="إجابتك" rows={8} placeholder="اكتب إجابتك هنا..." value={answers[question.id]?.essayText || ""} onChange={(e) => saveAnswer(question.id, { essayText: e.target.value })} />
                    <p className="mt-2 text-xs text-ink-3">إجابتك على السؤال ده بتتبعت للمدرس، وهو اللي بيحدد درجتها بعد ما تسلّم الاختبار.</p>
                  </div>
                )}
              </div>

              <p className="mt-5 h-5 text-xs flex items-center gap-1.5" role="status" aria-live="polite">
                {saveState === "saving" && <span className="text-ink-3 flex items-center gap-1.5"><Icon icon={Loader2} size={16} className="animate-spin" />جارِ الحفظ…</span>}
                {saveState === "saved" && <span className="text-ok flex items-center gap-1.5"><Icon icon={CheckCircle2} size={16} />تم حفظ إجابتك</span>}
                {saveState === "error" && <span className="text-warn flex items-center gap-1.5"><Icon icon={CloudOff} size={16} />الاتصال ضعيف، إجابتك محفوظة عندك وهنحاول نحفظها تاني</span>}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="secondary" icon={ArrowBack} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>السابق</Button>
              {current < total - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>التالي<Icon icon={ArrowForward} size={16} /></Button>
              ) : (
                <Button icon={Flag} onClick={() => setReviewOpen(true)} loading={submitting}>راجع وسلّم</Button>
              )}
            </div>
          </main>

          <aside className="hidden lg:block sticky top-6 panel p-5" aria-label="التنقل بين الأسئلة">
            <h3 className="font-bold text-ink mb-3">الأسئلة <span className="text-ink-3 font-medium num">({answeredCount}/{total})</span></h3>
            <Navigator />
            <Button variant="secondary" icon={Flag} className="w-full mt-5" onClick={() => setReviewOpen(true)}>راجع وسلّم</Button>
          </aside>
        </div>
      </div>

      <Modal open={navOpen} onClose={() => setNavOpen(false)} title="الأسئلة"><Navigator onPick={() => setNavOpen(false)} /></Modal>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="تسليم الاختبار؟"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>كمّل الاختبار</Button>
            <Button onClick={handleSubmit} loading={submitting} data-autofocus>{submitting ? "جارِ التسليم..." : "تسليم نهائي"}</Button>
          </>
        }
      >
        <p className="text-ink">أجبت على <span className="num font-bold">{answeredCount}</span> من <span className="num font-bold">{total}</span> سؤال.</p>
        {unanswered.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm text-warn font-semibold">لسه ما جاوبتش على:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unanswered.map(({ i }) => (
                <button key={i} type="button" onClick={() => { setCurrent(i); setReviewOpen(false); }} className="btn btn-secondary btn-sm num !min-w-[44px]">{i + 1}</button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ok">جاوبت على كل الأسئلة.</p>
        )}
        <p className="mt-4 text-sm text-ink-3">بعد التسليم مش هتقدر تغيّر إجاباتك.</p>
      </Modal>
    </div>,
    document.body
  );
}
