import { Link } from "react-router-dom";
import { BookOpen, ClipboardList, ListChecks, PlayCircle } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import PageHeader from "../../components/ui/PageHeader";
import Cover from "../../components/ui/Cover";
import Icon, { ChevronForward } from "../../components/ui/Icon";
import CountUp from "../../components/ui/CountUp";

export default function StudentCoursesPage() {
  const { data, loading, error, refetch } = useApi("/student/courses");

  if (loading) return <LoadingState variant="grid" rows={6} label="جارِ تحميل الكورسات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="كورساتي" description="كل الكورسات اللي مسجّل فيها، ادخل على أي كورس تلاقي فيديوهاته وواجباته وملفاته." />
      {data.courses.length === 0 ? (
        <EmptyState illustration="book" title="لسه مش مسجّل في أي كورس" message="لما مدرسك يسجّلك في كورس هتلاقيه هنا." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {data.courses.map((c) => (
            <Link key={c.id} to={`/student/courses/${c.id}`} className="group card card-interactive overflow-hidden flex flex-col">
              <Cover seed={c.title + c.id} src={c.imageUrl} icon={BookOpen} />
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-ink text-lg leading-snug">{c.title}</h3>
                {c.description && <p className="text-sm text-ink-2 mt-1 line-clamp-2">{c.description}</p>}
                <div className="mt-auto pt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    [PlayCircle, "text-video", c._count.videos, "فيديو"],
                    [ClipboardList, "text-homework", c._count.homework, "واجب"],
                    [ListChecks, "text-exam", c._count.exams, "اختبار"],
                  ].map(([ic, tone, n, label]) => (
                    <div key={label} className="rounded-xl bg-sunken px-2 py-2">
                      <p className="num text-base font-bold leading-none text-ink"><CountUp value={n} /></p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-3"><Icon icon={ic} size={14} className={tone} />{label}</p>
                    </div>
                  ))}
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-ink">
                  افتح الكورس <Icon icon={ChevronForward} size={16} className="transition-transform duration-200 group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
