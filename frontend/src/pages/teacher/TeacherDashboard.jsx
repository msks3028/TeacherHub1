import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardList, Eye, FileText, ListChecks, PlayCircle, Plus, Upload, UserPlus, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import Icon from "../../components/ui/Icon";
import CountUp from "../../components/ui/CountUp";
import PenUnderline from "../../components/ui/PenUnderline";
import ContentIcon from "../../components/ui/ContentIcon";
import { fmtDateTime, fmtDayLong, fmtNumber, firstName } from "../../lib/format";

// Tile colours come from the same content-type tokens used everywhere else.
const TILE = {
  primary: ["var(--primary-soft)", "var(--primary-ink)"],
  video: ["var(--t-video-bg)", "var(--t-video)"],
  homework: ["var(--t-homework-bg)", "var(--t-homework)"],
  exam: ["var(--t-exam-bg)", "var(--t-exam)"],
  file: ["var(--t-file-bg)", "var(--t-file)"],
  note: ["var(--t-note-bg)", "var(--t-note)"],
};

const ACTIVE_NOW_MS = 15 * 60 * 1000;

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi("/teacher/dashboard");

  if (loading) return <LoadingState variant="stats" rows={4} label="جارِ تحميل الإحصائيات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const s = data.stats;
  const attention = [
    { label: "واجبات تحتاج تصحيح", count: s.homeworkAwaitingGrading, to: "/teacher/homework", cta: "صحّح الواجبات" },
    { label: "أسئلة مقالية تحتاج تصحيح", count: s.examsAwaitingGrading, to: "/teacher/exams", cta: "صحّح الأسئلة" },
  ];
  const waiting = attention.reduce((sum, a) => sum + (a.count || 0), 0);
  const figures = [
    { label: "الطلاب", value: s.studentsCount, icon: Users, tone: "primary", to: "/teacher/students" },
    { label: "الكورسات", value: s.coursesCount, icon: BookOpen, tone: "primary", to: "/teacher/courses" },
    { label: "الفيديوهات", value: s.videosCount, icon: PlayCircle, tone: "video", to: "/teacher/videos" },
    { label: "مشاهدات الفيديو", value: s.totalVideoViews, icon: Eye, tone: "video" },
    { label: "الواجبات", value: s.homeworkCount, icon: ClipboardList, tone: "homework", to: "/teacher/homework" },
    { label: "الاختبارات", value: s.examsCount, icon: ListChecks, tone: "exam", to: "/teacher/exams" },
    { label: "الملفات", value: s.materialsCount, icon: FileText, tone: "file", to: "/teacher/materials" },
    { label: "الحصص", value: s.lessonsCount, icon: BookOpen, tone: "note" },
  ];
  const quick = [
    { label: "إضافة طالب", icon: UserPlus, to: "/teacher/students" },
    { label: "رفع فيديو", icon: Upload, to: "/teacher/videos" },
    { label: "واجب جديد", icon: Plus, to: "/teacher/homework" },
  ];
  const now = Date.now();

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ hero: the notebook cover */}
      <header className="relative overflow-hidden rounded-3xl bg-sidebar text-sidebar-ink" style={{ "--ring": "var(--sb-ink)" }}>
        <svg className="absolute inset-0 h-full w-full text-sidebar-ink opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="hero-rule" width="100%" height="36" patternUnits="userSpaceOnUse"><line x1="0" y1="35" x2="100%" y2="35" stroke="currentColor" strokeWidth="1.5" /></pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-rule)" />
        </svg>
        <div className="absolute inset-y-0 start-7 w-px bg-pen opacity-60" aria-hidden="true" />

        <div className="relative flex flex-col gap-6 p-6 ps-12 md:flex-row md:items-end md:justify-between md:p-8 md:ps-16">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-ink2">{fmtDayLong()}</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight md:text-4xl">
              أهلاً يا <span className="relative inline-block">{firstName(user?.profile?.fullName)}<PenUnderline /></span>
            </h1>
            <p className="mt-3 max-w-md text-sidebar-ink2">
              {waiting > 0
                ? <>فيه <span className="num font-bold text-sidebar-ink">{fmtNumber(waiting)}</span> حاجة مستنياك تصحّحها.</>
                : "كل حاجة متصحّحة، ومفيش حاجة مستنياك دلوقتي."}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 md:w-auto">
            {quick.map((q) => (
              <button
                key={q.to}
                type="button"
                onClick={() => navigate(q.to, { state: { create: true } })}
                className="group flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl bg-sidebar-hover px-4 py-3 text-sm font-semibold text-sidebar-ink transition-colors hover:bg-sidebar-active md:min-w-[104px]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-ink text-sidebar transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"><Icon icon={q.icon} size={20} /></span>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ what needs me right now */}
      <section aria-label="محتاج تصرّف" className="grid gap-4 sm:grid-cols-2 stagger">
        {attention.map((a) =>
          a.count > 0 ? (
            <Link key={a.to} to={a.to} className="card card-interactive relative flex items-center gap-4 p-5" style={{ borderInlineStartWidth: 4, borderInlineStartColor: "var(--pen)" }}>
              <span className="absolute end-4 top-4 flex h-3 w-3" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pen opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-pen" />
              </span>
              <span className="ct ct-lg ct-warn"><Icon icon={AlertCircle} size={24} /></span>
              <div className="min-w-0 flex-1">
                <p className="num text-3xl font-bold leading-none text-ink"><CountUp value={a.count} format={fmtNumber} /></p>
                <p className="mt-1.5 text-sm font-semibold text-ink-2">{a.label}</p>
              </div>
              <span className="btn btn-soft btn-sm" aria-hidden="true">{a.cta}</span>
            </Link>
          ) : (
            <div key={a.to} className="panel flex items-center gap-4 p-5">
              <span className="ct ct-lg ct-ok"><Icon icon={CheckCircle2} size={24} /></span>
              <div>
                <p className="font-bold text-ink">{a.label}</p>
                <p className="text-sm text-ink-3">مفيش حاجة مستنية، كله متصحّح.</p>
              </div>
            </div>
          )
        )}
      </section>

      {/* ------------------------------------------------ the numbers, one tinted tile per kind of content */}
      <section aria-label="أرقام المنصة">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 stagger">
          {figures.map((f) => {
            const [bg, fg] = TILE[f.tone];
            const inner = (
              <>
                <Icon icon={f.icon} size={84} className="pointer-events-none absolute -bottom-4 -end-3 -rotate-12 opacity-[0.16]" />
                <span className="relative inline-flex items-center gap-2 text-sm font-semibold text-ink-2">
                  <Icon icon={f.icon} size={16} />{f.label}
                </span>
                <span className="num relative mt-3 block text-3xl font-bold leading-none text-ink"><CountUp value={f.value} format={fmtNumber} /></span>
              </>
            );
            const cls = "relative block min-h-[112px] overflow-hidden rounded-2xl p-4 md:p-5";
            return f.to ? (
              <Link key={f.label} to={f.to} className={`${cls} transition-transform duration-200 hover:-translate-y-0.5`} style={{ background: bg, color: fg }}>{inner}</Link>
            ) : (
              <div key={f.label} className={cls} style={{ background: bg, color: fg }}>{inner}</div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="rs-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="rs-h" className="flex items-center gap-2.5 text-lg font-bold text-ink"><span className="ct ct-sm ct-primary"><Icon icon={Users} size={16} /></span>آخر الطلاب نشاطًا</h2>
            <Link to="/teacher/students" className="py-2 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline">كل الطلاب</Link>
          </div>
          {data.recentStudents.length === 0 ? (
            <div className="panel"><EmptyState compact illustration="inbox" message="لا يوجد نشاط بعد." /></div>
          ) : (
            <ul className="panel divide-soft overflow-hidden">
              {data.recentStudents.map((st) => {
                const activeNow = st.lastActiveAt && now - new Date(st.lastActiveAt).getTime() < ACTIVE_NOW_MS;
                return (
                  <li key={st.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={st.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{st.fullName}</span>
                      <span className="num block text-xs text-ink-3">{st.lastActiveAt ? fmtDateTime(st.lastActiveAt) : "لم يسجّل دخول بعد"}</span>
                    </span>
                    {activeNow && <Badge tone="ok" dot>نشط الآن</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="sub-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="sub-h" className="flex items-center gap-2.5 text-lg font-bold text-ink"><ContentIcon type="homework" size="sm" />آخر تسليمات الواجبات</h2>
            <Link to="/teacher/homework" className="py-2 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline">الواجبات</Link>
          </div>
          {data.recentSubmissions.length === 0 ? (
            <div className="panel"><EmptyState compact illustration="file" message="لا يوجد تسليمات بعد." /></div>
          ) : (
            <ul className="panel divide-soft overflow-hidden">
              {data.recentSubmissions.map((sub) => (
                <li key={sub.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={sub.student.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{sub.student.fullName}</p>
                    <p className="truncate text-xs text-ink-3">{sub.homework.title}</p>
                  </div>
                  <Badge tone={sub.status === "LATE" ? "warn" : "neutral"}>{sub.status === "LATE" ? "متأخر" : "في الوقت"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
