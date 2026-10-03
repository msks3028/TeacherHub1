import { useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle2, ClipboardList, FileText, PlayCircle } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import CoverHeader from "../../components/common/CoverHeader";
import Icon from "../../components/ui/Icon";
import VideoGallery from "../../components/common/VideoGallery";
import MaterialItem from "../../components/common/MaterialItem";
import StudentHomeworkList from "../../components/homework/StudentHomeworkList";
import Button from "../../components/ui/Button";
import api from "../../services/api";

export default function StudentLessonDetailPage() {
  const { lessonId } = useParams();
  const { data, loading, error, refetch } = useApi(`/student/lessons/${lessonId}`);
  const [savingProgress, setSavingProgress] = useState(false);
  if (loading) return <LoadingState label="جارِ تحميل الدرس..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const lesson = data.lesson;
  const completed = !!lesson.progress?.[0]?.completedAt;
  async function toggleProgress() {
    setSavingProgress(true);
    try { await api.patch(`/student/lessons/${lesson.id}/progress`, { completed: !completed }); refetch(); }
    catch (err) { toast.error(err.message); }
    finally { setSavingProgress(false); }
  }
  const SectionTitle = ({ id, icon, tone, children }) => <h2 id={id} className="mb-3 flex items-center gap-2.5 font-display text-lg font-bold text-ink"><span className={`ct ct-sm ${tone}`}><Icon icon={icon} size={16} /></span>{children}</h2>;
  return <>
    <CoverHeader
      back={lesson.course ? { to: `/student/courses/${lesson.course.id}`, label: lesson.course.title } : { to: "/student/courses", label: "الكورسات" }}
      eyebrow={lesson.unit?.title}
      title={lesson.title}
      description={lesson.description}
      stats={[{ label: "فيديو", value: lesson.videos.length }, { label: "ملف", value: lesson.materials.length }, { label: "واجب", value: lesson.homework.length }]}
      actions={<Button variant={completed ? "soft" : "secondary"} icon={CheckCircle2} loading={savingProgress} aria-pressed={completed} onClick={toggleProgress}>{completed ? "تم إكمال الدرس" : "تحديد كمكتمل"}</Button>}
    />
    {completed && <div className="mb-6 flex items-center gap-3 rounded-2xl p-4 anim-rise" style={{ background: "var(--ok-bg)", color: "var(--ok)" }} role="status"><Icon icon={CheckCircle2} size={22} /><p className="text-sm font-bold">خلّصت الدرس ده، كمّل على اللي بعده.</p></div>}
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0 space-y-8">
        <section aria-labelledby="lesson-videos"><SectionTitle id="lesson-videos" icon={PlayCircle} tone="ct-video">الفيديوهات</SectionTitle>{lesson.videos.length ? <VideoGallery videos={lesson.videos} /> : <EmptyState compact illustration="book" title="لا توجد فيديوهات" />}</section>
        <section aria-labelledby="lesson-homework"><SectionTitle id="lesson-homework" icon={ClipboardList} tone="ct-homework">الواجبات</SectionTitle><StudentHomeworkList homework={lesson.homework} onChanged={refetch} emptyMessage="لا يوجد واجب مرتبط بهذا الدرس." /></section>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-[calc(var(--topbar-h)+16px)]" aria-labelledby="lesson-materials">
        <SectionTitle id="lesson-materials" icon={FileText} tone="ct-file">الملفات</SectionTitle>
        {lesson.materials.length ? <ul className="space-y-3">{lesson.materials.map((material) => <MaterialItem key={material.id} material={material} />)}</ul> : <EmptyState compact illustration="file" title="لا توجد ملفات" />}
        {!completed && (
          <div className="mt-6 card p-4 text-center">
            <p className="text-sm font-bold text-ink">خلّصت الدرس؟</p>
            <p className="mt-1 text-xs text-ink-3">علّم عليه عشان تتابع تقدّمك.</p>
            <Button className="mt-3 w-full" icon={CheckCircle2} loading={savingProgress} onClick={toggleProgress}>تحديد كمكتمل</Button>
          </div>
        )}
      </aside>
    </div>
  </>;
}
