import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import PageHeader from "../../components/ui/PageHeader";
import Tabs, { TabPanel } from "../../components/ui/Tabs";
import VideoGallery from "../../components/common/VideoGallery";
import MaterialItem from "../../components/common/MaterialItem";
import StudentHomeworkList from "../../components/homework/StudentHomeworkList";
import StudentExamsList from "../../components/exam/StudentExamsList";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import Icon from "../../components/ui/Icon";

export default function StudentCourseDetailPage() {
  const { courseId } = useParams();
  const { data, loading, error, refetch } = useApi(`/student/courses/${courseId}`);
  const [tab, setTab] = useState("videos");

  if (loading) return <LoadingState label="جارِ تحميل الكورس..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const course = data.course;
  const tabs = [
    { key: "videos", label: "الفيديوهات", count: course.videos.length },
    { key: "homework", label: "الواجبات", count: course.homework.length },
    { key: "materials", label: "الملفات", count: course.materials.length },
    { key: "exams", label: "الاختبارات", count: course.exams.length },
  ];

  return (
    <>
      <PageHeader back={{ to: "/student/courses", label: "كل الكورسات" }} title={course.title} description={course.description} />
      {!!course.units?.length && <section className="mb-6" aria-labelledby="units-heading"><h2 id="units-heading" className="mb-3 font-display text-xl font-bold text-ink">وحدات الكورس</h2><div className="grid md:grid-cols-2 gap-3">{course.units.map((unit) => <article key={unit.id} className="card p-4 min-w-0"><h3 className="font-bold text-ink break-words">{unit.title}</h3>{unit.description && <p className="mt-1 text-sm text-ink-2">{unit.description}</p>}{unit.lessons.length ? <ul className="mt-3 divide-y divide-line">{unit.lessons.map((lesson) => <li key={lesson.id}><Link to={`/student/lessons/${lesson.id}`} className="flex min-h-[44px] items-center gap-2 py-2 text-sm font-semibold text-primary-ink hover:underline"><Icon icon={BookOpen} size={16} /><span className="min-w-0 flex-1 break-words">{lesson.title}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-ink-3">لا توجد دروس بعد.</p>}</article>)}</div></section>}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-6">
        <TabPanel id={tab}>
          {tab === "videos" && (
            course.videos.length === 0 ? <EmptyState illustration="book" title="لسه مفيش فيديوهات" message="لما المدرس يرفع فيديوهات الكورس هتظهر هنا." /> : (
              <VideoGallery videos={course.videos} />
            )
          )}
          {tab === "homework" && <StudentHomeworkList homework={course.homework} onChanged={refetch} emptyMessage="لا يوجد واجبات في هذا الكورس بعد." />}
          {tab === "materials" && (
            course.materials.length === 0 ? <EmptyState illustration="file" title="لسه مفيش ملفات" message="لا يوجد ملفات بعد." /> : (
              <ul className="grid sm:grid-cols-2 gap-3 stagger">{course.materials.map((m) => <MaterialItem key={m.id} material={m} />)}</ul>
            )
          )}
          {tab === "exams" && <StudentExamsList exams={course.exams} onChanged={refetch} emptyMessage="لا يوجد اختبارات في هذا الكورس بعد." />}
        </TabPanel>
      </div>
    </>
  );
}
