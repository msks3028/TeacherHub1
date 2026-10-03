import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle2, ClipboardList, Clock, Eye, Film, Plus } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import PageHeader from "../../components/ui/PageHeader";
import Icon from "../../components/ui/Icon";
import CountUp from "../../components/ui/CountUp";
import VisibilitySelector from "../../components/ui/VisibilitySelector";
import { Checkbox, FileDrop, Input, Textarea } from "../../components/ui/Form";
import ImageUpload from "../../components/ui/ImageUpload";
import HomeworkVideosModal from "../../components/common/HomeworkVideosModal";
import { ScoreMark } from "../../components/ui/Progress";
import api from "../../services/api";
import { uploadFile } from "../../lib/upload";
import { LEVEL_BADGE, deadlineInfo, fmtDateTime, fmtNumber } from "../../lib/format";

export default function HomeworkPage() {
  const { data, loading, error, refetch } = useApi("/teacher/homework");
  const location = useLocation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null); // homeworkId to view submissions for
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", allowLateSubmission: false });
  const [visibility, setVisibility] = useState({ visibility: "ALL_STUDENTS", grade: "", group: "" });
  const [submitting, setSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState("");
  const [progress, setProgress] = useState(null);
  const [videosOf, setVideosOf] = useState(null); // the homework whose videos are open

  useEffect(() => {
    if (location.state?.create) { setCreateOpen(true); navigate(location.pathname, { replace: true, state: null }); }
  }, [location, navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Upload the video first: if that fails, no half-created homework is left behind.
      let videoUrl = null;
      if (videoFile) {
        setProgress(0);
        videoUrl = (await uploadFile("/teacher/upload/video", videoFile, setProgress)).data.url;
      }

      // No courseId here => a general homework, visible to students per its
      // visibility setting, not tied to any specific course.
      const { data: created } = await api.post("/teacher/homework", { ...form, ...visibility });

      if (videoUrl) {
        await api.post(`/teacher/homework/${created.homework.id}/video`, {
          title: `شرح: ${form.title}`,
          fileUrl: videoUrl,
          thumbnailUrl: thumbnail || null,
        });
      }

      toast.success("تمت إضافة الواجب" + (videoUrl ? " مع فيديو الشرح" : ""));
      setCreateOpen(false);
      setForm({ title: "", description: "", deadline: "", allowLateSubmission: false });
      setVisibility({ visibility: "ALL_STUDENTS", grade: "", group: "" });
      setVideoFile(null);
      setThumbnail("");
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (loading && !data) return <LoadingState variant="list" label="جارِ تحميل الواجبات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="الواجبات" description="كل الواجبات وتسليمات الطلاب في مكان واحد." actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>إضافة واجب</Button>} />

      {data.homework.length === 0 ? (
        <EmptyState illustration="file" title="لسه مفيش واجبات" message="أضف واجبًا وحدّد موعد التسليم." action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>إضافة واجب</Button>} />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {data.homework.map((h) => {
            const dl = deadlineInfo(h.deadline);
            return (
              <li key={h.id} className="card card-interactive overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 p-4" style={{ background: "var(--t-homework-bg)" }}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-raised" style={{ color: "var(--t-homework)" }} aria-hidden="true"><Icon icon={ClipboardList} size={24} /></span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink leading-snug break-words">{h.title}</h3>
                    <p className="mt-0.5 text-xs text-ink-2 num">{h.deadline ? fmtDateTime(h.deadline) : "بدون موعد نهائي"}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="num text-3xl font-bold leading-none text-ink"><CountUp value={h._count.submissions} format={fmtNumber} /></p>
                      <p className="mt-1.5 text-xs text-ink-3">تسليم</p>
                    </div>
                    {h.deadline && <span className={LEVEL_BADGE[dl.level]}><Icon icon={Clock} size={14} />{dl.label}</span>}
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button variant="soft" size="sm" icon={Film} onClick={() => setVideosOf(h)}>الفيديوهات</Button>
                    <Button size="sm" icon={Eye} onClick={() => setSelected(h.id)}>التسليمات</Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && <SubmissionsModal homeworkId={selected} onClose={() => setSelected(null)} onGraded={refetch} />}
      {videosOf && <HomeworkVideosModal homework={videosOf} onClose={() => setVideosOf(null)} onChanged={refetch} />}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="إضافة واجب عام"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>إلغاء</Button><Button type="submit" form="create-hw" loading={submitting}>{submitting ? "جارِ الإضافة..." : "إضافة"}</Button></>}>
        <form id="create-hw" onSubmit={handleCreate} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الأساسيات</legend>
            <Input label="عنوان الواجب" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea label="الوصف" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الاستهداف</legend>
            <VisibilitySelector value={visibility} onChange={setVisibility} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">فيديو الشرح (اختياري)</legend>
            <FileDrop label="ملف الفيديو" kind="video" accept="video/*" hint="MP4 (H.264 + AAC) أفضل صيغة" file={videoFile} onFile={setVideoFile} progress={progress} disabled={submitting} />
            {videoFile && <ImageUpload label="صورة الفيديو (اختياري)" value={thumbnail} onChange={setThumbnail} disabled={submitting} />}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-ink-2 mb-3">التواريخ</legend>
            <Input label="الموعد النهائي" hint="اختياري" type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <Checkbox checked={form.allowLateSubmission} onChange={(e) => setForm({ ...form, allowLateSubmission: e.target.checked })} label="السماح بالتسليم المتأخر بعد الموعد النهائي" />
          </fieldset>
        </form>
      </Modal>
    </>
  );
}

function SubmissionsModal({ homeworkId, onClose, onGraded }) {
  const { data, loading, error, refetch } = useApi(`/teacher/homework/${homeworkId}`);
  const [grading, setGrading] = useState(null);
  const [gradeValue, setGradeValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleGrade(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/teacher/homework/submissions/${grading.id}/grade`, { grade: Number(gradeValue), feedback });
      toast.success("تم إرسال الدرجة للطالب");
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
    <Modal open onClose={onClose} title={data ? `تسليمات: ${data.homework.title}` : "جارِ التحميل..."} wide>
      {loading && !data && <LoadingState variant="list" rows={3} />}
      {error && <ErrorState message={error} />}
      {data && data.homework.submissions.length === 0 && <EmptyState compact illustration="inbox" message="لا يوجد تسليمات بعد." />}
      {data && data.homework.submissions.length > 0 && (
        <ul className="space-y-3">
          {data.homework.submissions.map((sub) => (
            <li key={sub.id} className="panel p-4">
              <div className="flex items-start gap-3">
                <Avatar name={sub.student.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{sub.student.fullName}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    {sub.isLate ? <Badge tone="warn" icon={Clock}>تسليم متأخر</Badge> : <Badge tone="ok" icon={CheckCircle2}>في الوقت</Badge>}
                    <span className="num">{sub.submittedAt ? fmtDateTime(sub.submittedAt) : ""}</span>
                  </p>
                  {sub.answerText && <p className="text-sm text-ink-2 mt-3 rounded bg-sunken p-3 whitespace-pre-wrap">{sub.answerText}</p>}
                </div>
                <div className="shrink-0">
                  {sub.status === "GRADED" ? (
                    <ScoreMark score={sub.grade} size="sm" />
                  ) : (
                    <Button variant="soft" size="sm" onClick={() => { setGrading(sub); setGradeValue(""); setFeedback(""); }}>تصحيح</Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {grading && (
        <Modal open onClose={() => setGrading(null)} title={`تصحيح: ${grading.student.fullName}`}
          footer={<><Button variant="secondary" onClick={() => setGrading(null)}>إلغاء</Button><Button type="submit" form="grade-hw" loading={submitting}>{submitting ? "جارِ الإرسال..." : "إرسال الدرجة"}</Button></>}>
          <form id="grade-hw" onSubmit={handleGrade} className="space-y-4">
            {grading.answerText && <p className="text-sm text-ink-2 rounded bg-sunken p-3 whitespace-pre-wrap">{grading.answerText}</p>}
            <Input required label="الدرجة" type="number" inputMode="decimal" value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} />
            <Textarea label="ملاحظات" hint="اختياري، بتظهر للطالب" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </form>
        </Modal>
      )}
    </Modal>
  );
}
