import { useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Clock, MessageSquareText, Send } from "lucide-react";
import { EmptyState } from "../common/StateViews";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import ContentIcon from "../ui/ContentIcon";
import { FileDrop, Textarea } from "../ui/Form";
import { ScoreMark } from "../ui/Progress";
import VideoPlayer from "../common/VideoPlayer";
import MaterialItem from "../common/MaterialItem";
import api from "../../services/api";
import { LEVEL_BADGE, deadlineInfo, fmtDateTime } from "../../lib/format";

// Colour of the card's leading edge: how urgent it is, or how it ended up.
const ACCENT = {
  none: "var(--line-strong)", calm: "var(--line-strong)", soon: "var(--info-solid)",
  warn: "var(--warn-solid)", urgent: "var(--bad-solid)", late: "var(--bad-solid)",
};

/**
 * Full homework list with submit capability — shared between the standalone
 * "الواجبات" page and a course's own Homework tab, so a student can always
 * actually submit, whether the homework is general or scoped to a course.
 */
export default function StudentHomeworkList({ homework, onChanged, emptyMessage = "لا يوجد واجبات حاليًا." }) {
  const [selected, setSelected] = useState(null);

  if (homework.length === 0) {
    return <EmptyState illustration="check" title="مفيش واجبات" message={emptyMessage} />;
  }

  const pending = homework.filter((h) => !h.mySubmission);
  const done = homework.filter((h) => h.mySubmission);

  const renderItem = (h) => {
    const dl = deadlineInfo(h.deadline);
    const isPastDeadline = h.deadline && new Date(h.deadline) < new Date();
    const canSubmit = !isPastDeadline || h.allowLateSubmission;
    const sub = h.mySubmission;
    const graded = sub?.status === "GRADED";
    const accent = graded ? "var(--ok-solid)" : sub ? "var(--info-solid)" : ACCENT[dl.level] || ACCENT.none;

    return (
      <li key={h.id} className="card p-4 md:p-5" style={{ borderInlineStartWidth: 4, borderInlineStartColor: accent }}>
        <div className="flex items-start gap-3.5">
          <ContentIcon type="homework" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h3 className="font-bold text-ink">{h.title}</h3>
              {graded && <Badge tone="ok" icon={CheckCircle2}>اتصحّح</Badge>}
              {sub && !graded && sub.status === "LATE" && <Badge tone="warn" icon={Clock}>اتسلّم متأخر</Badge>}
              {sub && !graded && sub.status !== "LATE" && <Badge tone="info" icon={CheckCircle2}>تم التسليم</Badge>}
              {!sub && h.deadline && (
                <span className={LEVEL_BADGE[dl.level]}>
                  <Icon icon={Clock} size={14} />
                  {dl.late && h.allowLateSubmission ? "متأخر، التسليم لسه متاح" : dl.label}
                </span>
              )}
            </div>
            {h.description && <p className="text-sm text-ink-2 mt-1.5 whitespace-pre-wrap">{h.description}</p>}
            {h.deadline && <p className="text-xs text-ink-3 mt-2 num">الموعد النهائي: {fmtDateTime(h.deadline)}</p>}
          </div>
          {graded && <ScoreMark score={sub.grade} size="md" className="hidden sm:grid" />}
        </div>

        {graded && (
          <div className="sm:hidden mt-3 flex justify-center"><ScoreMark score={sub.grade} size="md" /></div>
        )}

        {sub?.feedback && (
          <div className="mt-4 flex gap-2.5 rounded bg-sunken p-3.5 text-sm">
            <Icon icon={MessageSquareText} size={16} className="mt-1 shrink-0 text-ink-3" />
            <div>
              <p className="font-semibold text-ink">ملاحظات المدرس</p>
              <p className="text-ink-2 mt-0.5 whitespace-pre-wrap">{sub.feedback}</p>
            </div>
          </div>
        )}

        {h.explanationVideos?.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {h.explanationVideos.map((v) => <VideoPlayer key={v.id} video={v} />)}
          </div>
        )}

        {h.materials?.length > 0 && (
          <section className="mt-4" aria-label={`ملفات الواجب: ${h.title}`}>
            <h4 className="mb-2 text-sm font-semibold text-ink-2">ملفات الواجب</h4>
            <ul className="grid gap-3">{h.materials.map((material) => <MaterialItem key={material.id} material={material} />)}</ul>
          </section>
        )}

        {!sub && (
          <div className="mt-4 flex items-center justify-between gap-3">
            {canSubmit ? (
              <Button onClick={() => setSelected(h)} icon={Send} className="w-full sm:w-auto">تسليم الواجب</Button>
            ) : (
              <Badge tone="bad">انتهى موعد التسليم</Badge>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section aria-label="واجبات لسه ماتسلّمتش">
          {done.length > 0 && <h2 className="mb-3 text-sm font-bold text-ink-2">لسه ماتسلّمتش ({pending.length})</h2>}
          <ul className="space-y-3 stagger">{pending.map(renderItem)}</ul>
        </section>
      )}
      {done.length > 0 && (
        <section aria-label="واجبات تم تسليمها">
          {pending.length > 0 && <h2 className="mb-3 text-sm font-bold text-ink-2">تم تسليمها ({done.length})</h2>}
          <ul className="space-y-3 stagger">{done.map(renderItem)}</ul>
        </section>
      )}
      {selected && <SubmitModal homework={selected} onClose={() => setSelected(null)} onSubmitted={onChanged} />}
    </div>
  );
}

function SubmitModal({ homework, onClose, onSubmitted }) {
  const [answerText, setAnswerText] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let fileUrls = [];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        setProgress(0);
        const res = await api.post("/student/upload/submission", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
        });
        fileUrls = [res.data.url];
      }
      await api.post(`/student/homework/${homework.id}/submit`, { answerText, fileUrls });
      toast.success("تم تسليم الواجب بنجاح");
      onClose();
      onSubmitted();
    } catch (err) {
      toast.error(err.message);
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`تسليم: ${homework.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>إلغاء</Button>
          <Button type="submit" form="submit-homework" loading={submitting} icon={Send}>{submitting ? "جارِ التسليم..." : "تسليم"}</Button>
        </>
      }
    >
      <form id="submit-homework" onSubmit={handleSubmit} className="space-y-5">
        <Textarea label="إجابتك" placeholder="اكتب إجابتك هنا (اختياري إذا كنت سترفع ملف)" rows={5} value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
        <FileDrop label="إرفاق ملف (اختياري)" hint="صورة أو PDF أو أي ملف للحل" file={file} onFile={setFile} progress={progress} disabled={submitting} />
      </form>
    </Modal>
  );
}
