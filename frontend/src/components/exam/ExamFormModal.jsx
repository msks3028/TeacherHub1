import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Check, GripVertical, ListChecks, PenLine, Plus, Trash2, X } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Icon, { ArrowBack, ArrowForward } from "../ui/Icon";
import { Input, Select, Textarea } from "../ui/Form";
import VisibilitySelector from "../ui/VisibilitySelector";
import StatStrip from "../ui/StatStrip";
import api from "../../services/api";
import { fmtNumber } from "../../lib/format";

function emptyQuestion() {
  return { type: "MULTIPLE_CHOICE", text: "", points: 1, options: ["", ""], correctOptionIndex: 0 };
}

const STEPS = ["البيانات", "الأسئلة", "المراجعة"];
const STEP_HINTS = ["العنوان والاستهداف والمدة", "اكتب الأسئلة ورتّبها", "راجع قبل الإنشاء"];

/**
 * Full exam builder in three steps (details → questions → review), shared
 * between the general "الاختبارات" page and the "create exam" action inside a
 * course's own page. Pass fixedCourseId to skip the course dropdown entirely
 * and always scope the exam to that course.
 */
export default function ExamFormModal({ open, onClose, fixedCourseId, onCreated }) {
  const { data: coursesData } = useApi("/teacher/courses", { enabled: !fixedCourseId });

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(fixedCourseId || "");
  const [visibility, setVisibility] = useState({ visibility: "ALL_STUDENTS", grade: "", group: "" });
  const [durationMinutes, setDurationMinutes] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [armed, setArmed] = useState(null);

  function updateQuestion(i, patch) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateOption(qi, oi, value) {
    setQuestions((qs) => qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q)));
  }
  function removeOption(qi, oi) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== qi || q.options.length <= 2) return q;
        let correct = q.correctOptionIndex;
        if (oi < correct) correct -= 1;
        else if (oi === correct) correct = 0;
        return { ...q, options: q.options.filter((_, j) => j !== oi), correctOptionIndex: correct };
      })
    );
  }
  function move(i, dir) {
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function moveTo(from, to) {
    setQuestions((qs) => {
      if (from === to || from == null || to == null) return qs;
      const copy = [...qs];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }
  function resetDrag() { setDragFrom(null); setDragOver(null); setArmed(null); }

  function resetForm() {
    setStep(0);
    setErrors({});
    setTitle("");
    setCourseId(fixedCourseId || "");
    setDurationMinutes("");
    setPassingScore("");
    setQuestions([emptyQuestion()]);
    setVisibility({ visibility: "ALL_STUDENTS", grade: "", group: "" });
  }

  function validateStep(s) {
    const e = {};
    if (s === 0) {
      if (!title.trim()) e.title = "اكتب عنوان الاختبار";
      if (!fixedCourseId) {
        if (visibility.visibility === "GRADE" && !visibility.grade) e.visibility = "اختر الصف";
        if (visibility.visibility === "GROUP" && !visibility.group?.trim()) e.visibility = "اكتب اسم المجموعة";
      }
    }
    if (s === 1) {
      if (questions.length === 0) e.questions = "أضف سؤالًا واحدًا على الأقل";
      questions.forEach((q, i) => {
        if (!q.text.trim()) e[`q${i}`] = "اكتب نص السؤال";
        else if (q.type === "MULTIPLE_CHOICE" && q.options.some((o) => !o.trim())) e[`q${i}`] = "املأ كل الاختيارات أو احذف الفارغ منها";
      });
      // A passing score above the total marks can never be reached — everyone would "fail".
      const total = questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
      if (passingScore !== "" && Number(passingScore) > total) e.passing = `درجة النجاح (${passingScore}) أكبر من مجموع درجات الأسئلة (${total}). عدّلها في خطوة «البيانات» أو زوّد درجات الأسئلة.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => s + 1);
  }

  async function handleCreate() {
    if (!validateStep(0)) return setStep(0);
    if (!validateStep(1)) return setStep(1);
    setSubmitting(true);
    try {
      await api.post("/teacher/exams", {
        title,
        courseId: (fixedCourseId || courseId) || null,
        ...visibility,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        passingScore: passingScore ? Number(passingScore) : null,
        questions: questions.map((q) => ({
          type: q.type,
          text: q.text,
          points: Number(q.points) || 1,
          options: q.type === "MULTIPLE_CHOICE" ? q.options : undefined,
          correctOptionIndex: q.type === "MULTIPLE_CHOICE" ? q.correctOptionIndex : undefined,
        })),
      });
      toast.success(fixedCourseId || courseId ? "تم إنشاء الاختبار داخل الكورس" : "تم إنشاء الاختبار العام");
      resetForm();
      onClose();
      onCreated?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 1), 0);
  const courseTitle = fixedCourseId ? "هذا الكورس" : coursesData?.courses.find((c) => c.id === courseId)?.title || "اختبار عام";
  const visLabel = fixedCourseId ? "المسجّلون في الكورس" : { ALL_STUDENTS: "كل الطلاب", GRADE: `صف: ${visibility.grade}`, GROUP: `مجموعة: ${visibility.group}` }[visibility.visibility];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إنشاء اختبار جديد"
      size="xl"
      footer={
        <>
          {step > 0 && <Button variant="secondary" icon={ArrowBack} onClick={() => setStep((s) => s - 1)} disabled={submitting}>السابق</Button>}
          {step < 2 ? (
            <Button onClick={next}>التالي<Icon icon={ArrowForward} size={16} /></Button>
          ) : (
            <Button icon={Check} onClick={handleCreate} loading={submitting}>{submitting ? "جارِ الإنشاء..." : "إنشاء الاختبار"}</Button>
          )}
        </>
      }
    >
      {/* stepper */}
      <div className="mb-6">
        <ol className="grid grid-cols-3 gap-2" aria-label="خطوات إنشاء الاختبار">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className={`rounded-2xl px-3 py-2.5 transition-colors ${i === step ? "bg-primary-soft" : i < step ? "bg-ok-bg" : "bg-sunken"}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold num ${i < step ? "bg-ok-solid text-white" : i === step ? "bg-primary text-primary-on" : "bg-surface text-ink-3"}`}>{i < step ? <Icon icon={Check} size={14} /> : i + 1}</span>
                <span className={`text-sm font-bold ${i === step ? "text-primary-ink" : i < step ? "text-ok" : "text-ink-3"}`}>{label}</span>
              </div>
              <p className="mt-1 hidden text-xs text-ink-3 sm:block">{STEP_HINTS[i]}</p>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <div className="space-y-6 anim-rise">
          <Input label="عنوان الاختبار" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} data-autofocus />
          {!fixedCourseId && (
            <>
              <Select label="ربط الاختبار بكورس (اختياري)" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">اختبار عام (غير مرتبط بكورس)</option>
                {coursesData?.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
              <div>
                <VisibilitySelector value={visibility} onChange={setVisibility} />
                {errors.visibility && <p className="field-error" role="alert">{errors.visibility}</p>}
              </div>
            </>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="مدة الاختبار (بالدقائق)" hint="سيبها فاضية لو مفيش وقت محدد" type="number" inputMode="numeric" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            <Input
              label="درجة النجاح"
              hint="اختياري. رقم بالدرجات (مش نسبة مئوية). لو سيبتها فاضية مش هيظهر ناجح/راسب، هتظهر الدرجة بس."
              type="number" inputMode="decimal" min="0" value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              error={errors.passing}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 anim-rise">
          {errors.questions && <Alert tone="bad">{errors.questions}</Alert>}
          {errors.passing && <Alert tone="bad">{errors.passing}</Alert>}
          <p className="text-sm text-ink-3">مجموع درجات الأسئلة حاليًا: <span className="num font-bold text-ink">{fmtNumber(totalPoints)}</span></p>
          {questions.map((q, i) => (
            <fieldset
              key={i}
              draggable={armed === i}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragFrom(i); }}
              onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
              onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) moveTo(dragFrom, i); resetDrag(); }}
              onDragEnd={resetDrag}
              className={`panel space-y-4 p-4 md:p-5 transition-[box-shadow,opacity] ${errors[`q${i}`] ? "!border-bad-solid" : ""} ${dragFrom === i ? "opacity-50" : ""} ${dragOver === i && dragFrom !== i ? "ring-2 ring-[var(--primary)]" : ""}`}
            >
              <legend className="sr-only">سؤال {i + 1}</legend>
              <div className="flex flex-wrap items-center gap-2.5">
                <span onPointerDown={() => setArmed(i)} onPointerUp={() => setArmed(null)} className="grid h-9 w-7 cursor-grab touch-none place-items-center rounded-lg text-ink-3 hover:bg-sunken active:cursor-grabbing" aria-hidden="true" title="اسحب لإعادة الترتيب"><Icon icon={GripVertical} size={18} /></span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink num">{i + 1}</span>
                <div role="radiogroup" aria-label="نوع السؤال" className="inline-flex rounded-full bg-sunken p-1">
                  {[["MULTIPLE_CHOICE", "اختيار", ListChecks], ["ESSAY", "مقالي", PenLine]].map(([value, label, ic]) => (
                    <button key={value} type="button" role="radio" aria-checked={q.type === value} onClick={() => updateQuestion(i, { type: value })}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors ${q.type === value ? "bg-surface text-primary-ink shadow-1" : "text-ink-3 hover:text-ink"}`}><Icon icon={ic} size={15} />{label}</button>
                  ))}
                </div>
                <Input aria-label="الدرجة" placeholder="الدرجة" type="number" inputMode="decimal" min="0" value={q.points} onChange={(e) => updateQuestion(i, { points: e.target.value })} containerClassName="w-24" />
                <div className="ms-auto flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" iconOnly icon={ArrowUp} aria-label="نقل السؤال لأعلى" disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button variant="ghost" size="sm" iconOnly icon={ArrowDown} aria-label="نقل السؤال لأسفل" disabled={i === questions.length - 1} onClick={() => move(i, 1)} />
                  <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="حذف السؤال" className="!text-bad" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))} />
                </div>
              </div>
              <Textarea aria-label="نص السؤال" placeholder="نص السؤال" rows={2} value={q.text} onChange={(e) => updateQuestion(i, { text: e.target.value })} />

              {q.type === "MULTIPLE_CHOICE" && (
                <div className="space-y-2">
                  <p className="text-xs text-ink-3">اختار الدايرة جنب الإجابة الصح.</p>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className={`flex items-center gap-2.5 rounded-2xl p-1.5 transition-colors ${q.correctOptionIndex === oi ? "bg-ok-bg" : ""}`}>
                      <input type="radio" className="radio" name={`correct-${i}`} aria-label={`الاختيار ${oi + 1} هو الإجابة الصحيحة`} checked={q.correctOptionIndex === oi} onChange={() => updateQuestion(i, { correctOptionIndex: oi })} />
                      <input aria-label={`الاختيار ${oi + 1}`} placeholder={`اختيار ${oi + 1}`} className="input flex-1" value={opt} onChange={(e) => updateOption(i, oi, e.target.value)} />
                      {q.options.length > 2 && <Button variant="ghost" size="sm" iconOnly icon={X} aria-label={`حذف الاختيار ${oi + 1}`} onClick={() => removeOption(i, oi)} />}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" icon={Plus} onClick={() => updateQuestion(i, { options: [...q.options, ""] })}>إضافة اختيار</Button>
                </div>
              )}
              {errors[`q${i}`] && <p className="field-error" role="alert">{errors[`q${i}`]}</p>}
            </fieldset>
          ))}
          <Button variant="secondary" icon={Plus} className="w-full" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>إضافة سؤال جديد</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 anim-rise">
          <Alert tone="info">راجع البيانات قبل الإنشاء. بعد النشر مش هتقدر تعدّل الأسئلة من هنا.</Alert>
          <StatStrip items={[{ label: "سؤال", value: questions.length, tone: "exam" }, { label: "مجموع الدرجات", value: totalPoints, tone: "primary" }, { label: durationMinutes ? "دقيقة" : "بدون وقت", value: durationMinutes ? Number(durationMinutes) : "-", tone: "warn" }]} />
          <dl className="panel divide-soft text-sm">
            {[
              ["العنوان", title],
              ["الكورس", courseTitle],
              ["مين يشوفه", visLabel],
              ["درجة النجاح", passingScore || "غير محددة (بدون ناجح/راسب)"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-semibold text-ink text-end num">{v}</dd>
              </div>
            ))}
          </dl>
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-sunken p-3.5 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface font-bold text-ink-2 num">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink">{q.text}</p>
                  {q.type === "MULTIPLE_CHOICE" && <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-ok"><Icon icon={Check} size={14} />الإجابة الصحيحة: {q.options[q.correctOptionIndex]}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5"><Badge tone={q.type === "ESSAY" ? "info" : "neutral"}>{q.type === "ESSAY" ? "مقالي" : "اختياري"}</Badge><span className="text-xs text-ink-3 num">{fmtNumber(Number(q.points) || 1)} درجة</span></div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
