import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Video } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/StateViews";

const dayParts = (date) => {
  const d = new Date(date);
  return {
    day: new Intl.DateTimeFormat("ar-EG", { day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat("ar-EG", { month: "long" }).format(d),
  };
};
const formatDate = (date) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeStyle: "short" }).format(new Date(date));

export default function StudentLiveClassesPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi("/student/live-classes");
  const [joining, setJoining] = useState(null);
  const classes = data?.liveClasses || [];

  async function join(item) {
    setJoining(item.id);
    try {
      const { data: credentials } = await api.post(`/student/live-classes/${item.id}/join`);
      navigate(`/student/live-classes/${item.id}/room`, { state: { liveKitUrl: credentials.url, liveKitToken: credentials.token, liveClass: credentials.liveClass || item } });
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setJoining(null); }
  }

  if (loading) return <LoadingState variant="list" label="جارِ تحميل مواعيد الحصص..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return <>
    <PageHeader title="الحصص المباشرة" description="انضم إلى غرفة الفيديو داخل TeacherHub عندما يبدأ المدرس الفصل." />
    {classes.length === 0 ? <EmptyState illustration="book" title="لا توجد حصص قادمة" message="ستظهر هنا الفصول التي يسمح لك المدرس بحضورها." /> : <ul className="grid lg:grid-cols-2 gap-4 stagger">
      {classes.map((item) => { const parts = dayParts(item.startsAt); const live = item.status === "LIVE"; return <li key={item.id} className="card overflow-hidden flex min-w-0" style={{ borderInlineStartWidth: 4, borderInlineStartColor: live ? "var(--pen)" : "var(--primary)" }}>
        <div className="grid w-20 shrink-0 place-items-center bg-sunken p-3 text-center" aria-hidden="true">
          <div><p className="num font-display text-3xl font-bold leading-none text-ink">{parts.day}</p><p className="mt-1.5 text-xs font-semibold text-ink-2">{parts.month}</p></div>
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-ink break-words">{item.title}</h2>{live && <span className="badge badge-bad badge-dot">مباشر الآن</span>}</div>
          <p className="mt-1 text-sm text-ink-2">{formatDate(item.startsAt)}</p>
          <p className="text-xs text-ink-3 mt-1">{item.course?.title || "فصل مباشر"}{item.lesson?.title ? ` · ${item.lesson.title}` : ""}</p>
          {item.description && <p className="mt-3 text-sm text-ink-2 whitespace-pre-wrap break-words">{item.description}</p>}
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 flex-wrap">
            {item.attendedAt ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><Icon icon={Check} size={17} /> حضور مؤكد من اتصال الغرفة</span> : <span className="text-sm text-ink-3">{item.status === "LIVE" ? "الفصل بدأ ويمكنك الانضمام" : "بانتظار بدء المدرس للفصل"}</span>}
            <Button icon={Video} disabled={item.status !== "LIVE"} loading={joining === item.id} onClick={() => join(item)}>{item.status === "LIVE" ? "دخول الفصل" : "لم يبدأ بعد"}</Button>
          </div>
        </div>
      </li>; })}
    </ul>}
  </>;
}
