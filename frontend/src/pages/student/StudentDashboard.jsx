import { Link } from "react-router-dom";
import { BookOpen, Clock, PlayCircle, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import ContentIcon from "../../components/ui/ContentIcon";
import CountUp from "../../components/ui/CountUp";
import PenUnderline from "../../components/ui/PenUnderline";
import { ContentRow, RowList } from "../../components/ui/Card";
import { ProgressRing, ScoreMark } from "../../components/ui/Progress";
import { LEVEL_BADGE, deadlineInfo, fmtDate, fmtDayLong, fmtNumber, firstName, percent } from "../../lib/format";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi("/student/dashboard");

  if (loading) return <LoadingState label="جارِ تحميل الصفحة الرئيسية..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // "What do I need to do today?" — un-submitted homework (soonest first), then open exams.
  const todo = [
    ...data.upcomingHomework.filter((h) => !h.mySubmission).map((h) => ({ kind: "homework", id: h.id, title: h.title, deadline: h.deadline })),
    ...data.availableExams.map((ex) => ({ kind: "exam", id: ex.id, title: ex.title, endDate: ex.endDate })),
  ];
  const pendingHomework = todo.filter((t) => t.kind === "homework").length;

  const results = data.latestResults;
  const avg = results.length ? Math.round(results.reduce((sum, r) => sum + percent(r.score, r.maxScore), 0) / results.length) : null;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl bg-sidebar text-sidebar-ink" style={{ "--ring": "var(--sb-ink)" }}>
        <svg className="absolute inset-0 h-full w-full text-sidebar-ink opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="student-hero-rule" width="100%" height="36" patternUnits="userSpaceOnUse"><line x1="0" y1="35" x2="100%" y2="35" stroke="currentColor" strokeWidth="1.5" /></pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#student-hero-rule)" />
        </svg>
        <div className="absolute inset-y-0 start-7 w-px bg-pen opacity-60" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 p-6 ps-12 md:flex-row md:items-end md:justify-between md:p-8 md:ps-16">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-ink2">{fmtDayLong()}</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight md:text-4xl">أهلاً يا <span className="relative inline-block">{firstName(user?.profile?.fullName)}<PenUnderline /></span></h1>
            <p className="mt-3 max-w-md text-sidebar-ink2">
              {todo.length > 0 ? <>عندك <span className="num font-bold text-sidebar-ink">{todo.length}</span> حاجة مطلوبة منك.</> : "مفيش حاجة مطلوبة منك دلوقتي، كمّل براحتك."}
            </p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 md:w-auto">
            {[
              { label: "كورساتي", icon: BookOpen, to: "/student/courses" },
              { label: "الفيديوهات", icon: PlayCircle, to: "/student/videos" },
              { label: "اسأل المساعد", icon: Sparkles, to: "/student/ai" },
            ].map((q) => (
              <Link key={q.to} to={q.to} className="group flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl bg-sidebar-hover px-3 py-3 text-center text-sm font-semibold text-sidebar-ink transition-colors hover:bg-sidebar-active md:min-w-[104px]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-ink text-sidebar transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"><Icon icon={q.icon} size={20} /></span>
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
        <div className="space-y-8 min-w-0">
          {/* ---- what is required of me ---- */}
          <section aria-labelledby="todo-h">
            <h2 id="todo-h" className="text-lg font-bold text-ink mb-3">المطلوب منك</h2>
            {todo.length === 0 ? (
              <div className="panel">
                <EmptyState
                  compact
                  illustration="check"
                  title="خلّصت كل المطلوب"
                  message="وقت مناسب تراجع فيديو، أو تسأل المساعد الذكي عن أي حاجة مش واضحة."
                  action={<div className="flex flex-wrap justify-center gap-2"><Button as={Link} to="/student/videos" variant="soft">شاهد فيديو</Button><Button as={Link} to="/student/ai" variant="secondary">اسأل المساعد</Button></div>}
                />
              </div>
            ) : (
              <RowList className="stagger">
                {todo.map((t) => {
                  if (t.kind === "exam") {
                    return (
                      <ContentRow
                        key={`e${t.id}`}
                        type="exam"
                        title={t.title}
                        to="/student/exams"
                        meta={<><span className="badge badge-primary">اختبار متاح</span>{t.endDate && <span>ينتهي <span className="num">{fmtDate(t.endDate)}</span></span>}</>}
                      />
                    );
                  }
                  const dl = deadlineInfo(t.deadline);
                  return (
                    <ContentRow
                      key={`h${t.id}`}
                      type="homework"
                      title={t.title}
                      to="/student/homework"
                      meta={<><span className={LEVEL_BADGE[dl.level]}><Icon icon={Clock} size={14} />{dl.label}</span><span className="num">{fmtDate(t.deadline)}</span></>}
                    />
                  );
                })}
              </RowList>
            )}
          </section>

          {/* ---- new content ---- */}
          <section aria-labelledby="vid-h">
            <div className="flex items-center justify-between mb-3">
              <h2 id="vid-h" className="text-lg font-bold text-ink">آخر المحتوى الجديد</h2>
              <Link to="/student/videos" className="text-sm font-semibold text-primary-ink hover:underline underline-offset-4 py-2">عرض الكل</Link>
            </div>
            {data.latestVideos.length === 0 ? (
              <div className="panel"><EmptyState compact illustration="book" message="مفيش فيديوهات جديدة لسه." /></div>
            ) : (
              <RowList>
                {data.latestVideos.map((v) => <ContentRow key={v.id} type="video" title={v.title} to="/student/videos" meta={<span className="num">{fmtDate(v.createdAt)}</span>} />)}
              </RowList>
            )}
          </section>
        </div>

        {/* ---- side column ---- */}
        <aside className="space-y-6 min-w-0">
          <section className="panel p-5" aria-label="ملخص تقدّمك">
            <h2 className="text-lg font-bold text-ink mb-4">تقدّمك</h2>
            <div className="flex items-center gap-4">
              <ProgressRing value={avg ?? 0} size={84} stroke={8} tone={avg === null ? "primary" : avg >= 50 ? "ok" : "warn"} label={avg === null ? "لا توجد نتائج بعد" : `متوسط النتائج ${avg}%`}>
                <span className="num font-bold text-ink text-lg">{avg === null ? "-" : `${avg}%`}</span>
              </ProgressRing>
              <div>
                <p className="font-semibold text-ink">متوسط النتائج</p>
                <p className="text-sm text-ink-3">{avg === null ? "هيظهر بعد أول اختبار" : `من آخر ${fmtNumber(results.length)} نتيجة`}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-center">
              <Link to="/student/courses" className="rounded bg-sunken p-3 hover:bg-primary-soft transition-colors">
                <dt className="text-xs text-ink-3">كورساتي</dt>
                <dd className="num text-xl font-bold text-ink mt-0.5"><CountUp value={data.coursesCount} format={fmtNumber} /></dd>
              </Link>
              <Link to="/student/homework" className="rounded bg-sunken p-3 hover:bg-primary-soft transition-colors">
                <dt className="text-xs text-ink-3">واجبات مطلوبة</dt>
                <dd className="num text-xl font-bold text-ink mt-0.5"><CountUp value={pendingHomework} format={fmtNumber} /></dd>
              </Link>
            </dl>
          </section>

          <section aria-labelledby="res-h">
            <div className="flex items-center justify-between mb-3">
              <h2 id="res-h" className="text-lg font-bold text-ink">آخر النتائج</h2>
              <Link to="/student/results" className="text-sm font-semibold text-primary-ink hover:underline underline-offset-4 py-2">عرض الكل</Link>
            </div>
            {results.length === 0 ? (
              <div className="panel"><EmptyState compact illustration="file" message="مفيش نتائج لسه." /></div>
            ) : (
              <RowList>
                {results.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{r.exam.title}</p>
                      <p className="text-xs text-ink-3 num">{fmtDate(r.submittedAt)}</p>
                    </div>
                    <ScoreMark score={r.score} max={r.maxScore} size="sm" />
                  </div>
                ))}
              </RowList>
            )}
          </section>

          {data.announcements.length > 0 && (
            <section aria-labelledby="ann-h">
              <div className="flex items-center justify-between mb-3">
                <h2 id="ann-h" className="text-lg font-bold text-ink">من مدرسك</h2>
                <Link to="/student/announcements" className="text-sm font-semibold text-primary-ink hover:underline underline-offset-4 py-2">عرض الكل</Link>
              </div>
              <div className="space-y-3">
                {data.announcements.slice(0, 2).map((a) => (
                  <article key={a.id} className="panel p-4 flex gap-3">
                    <ContentIcon type="note" size="sm" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink">{a.title}</h3>
                      <p className="text-sm text-ink-2 mt-0.5 line-clamp-2">{a.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
