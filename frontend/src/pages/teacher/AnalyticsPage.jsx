import { useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import PageHeader from "../../components/ui/PageHeader";
import { Select, Input } from "../../components/ui/Form";
import Icon from "../../components/ui/Icon";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import { Activity, Award, BookOpenCheck, ClipboardCheck, GraduationCap, Users, Video, Wifi } from "lucide-react";
import { formatUtcDateInput, getAnalyticsDateRangeError, getDefaultAnalyticsDateRange, MAX_ANALYTICS_RANGE_DAYS, shiftUtcDateInput } from "../../lib/analyticsDateRange";

// one tinted tile per metric, using the same content-type colours as the rest of the platform
const TILE = {
  primary: ["var(--primary-soft)", "var(--primary-ink)"], ok: ["var(--ok-bg)", "var(--ok)"], warn: ["var(--warn-bg)", "var(--warn)"],
  video: ["var(--t-video-bg)", "var(--t-video)"], homework: ["var(--t-homework-bg)", "var(--t-homework)"],
  exam: ["var(--t-exam-bg)", "var(--t-exam)"], file: ["var(--t-file-bg)", "var(--t-file)"], note: ["var(--t-note-bg)", "var(--t-note)"],
};
const GRID_LINES = "repeating-linear-gradient(to top, transparent 0, transparent calc(25% - 1px), var(--line) calc(25% - 1px), var(--line) 25%)";

function fmt(value) { return value == null ? "—" : new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(value); }

export default function TeacherAnalyticsPage() {
  const [defaultRange] = useState(getDefaultAnalyticsDateRange);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [courseId, setCourseId] = useState("");
  const today = formatUtcDateInput(new Date());
  const rangeError = getAnalyticsDateRangeError(from, to, today);
  const { data: courseData } = useApi("/teacher/courses");
  const url = useMemo(() => `/teacher/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${courseId ? `&courseId=${encodeURIComponent(courseId)}` : ""}`, [from, to, courseId]);
  const { data, loading, error, refetch } = useApi(url, { enabled: !rangeError });

  const dateFilters = <section className="card mb-5 grid sm:grid-cols-3 gap-3 p-4" aria-label="تصفية التحليلات">
    <Input label="من تاريخ" type="date" value={from} min={shiftUtcDateInput(to, -(MAX_ANALYTICS_RANGE_DAYS - 1))} max={to || today} onChange={(e) => setFrom(e.target.value)} />
    <Input label="إلى تاريخ" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
    <Select label="الكورس" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">كل كورساتي</option>{(courseData?.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select>
    {rangeError && <p className="sm:col-span-3 text-sm text-bad" role="alert" aria-live="polite">{rangeError}</p>}
  </section>;

  if (rangeError) return <>
    <PageHeader title="تحليلات الطلاب" description="الأرقام محسوبة من المشاهدات والتسليمات والاختبارات وإكمال الدروس والحضور المسجّل." />
    {dateFilters}
  </>;

  if (loading && !data) return <LoadingState variant="stats" rows={8} label="جارِ تحميل التحليلات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const metrics = data.metrics;
  const statCards = [
    [Users, "الطلاب ضمن النطاق", metrics.students, "primary"],
    [Activity, "طلاب لديهم نشاط", metrics.activeStudents, "ok"],
    [GraduationCap, "بلا نشاط في المدة", metrics.studentsNeedingAttention, "warn"],
    [Video, "مشاهدات الفيديو", metrics.videoViews, "video"],
    [BookOpenCheck, "إكمال الدروس", metrics.lessonCompletions, "note"],
    [Award, "متوسط الاختبارات (%)", metrics.averageExamPercent, "exam"],
    [ClipboardCheck, "تسليمات الواجبات", metrics.homeworkSubmissions, "homework"],
    [Wifi, "حضور الحصص المباشرة", metrics.attendanceJoins, "file"],
  ];
  const trendMax = Math.max(1, ...data.trends.map((entry) => entry.activities));

  return <>
    <PageHeader title="تحليلات الطلاب" description="الأرقام محسوبة من المشاهدات والتسليمات والاختبارات وإكمال الدروس والحضور المسجّل." />
    {dateFilters}

    <section aria-label="المؤشرات" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 stagger">
      {statCards.map(([icon, label, value, tone]) => <article key={label} className="relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 min-h-[112px]" style={{ background: TILE[tone][0], color: TILE[tone][1] }}>
        <Icon icon={icon} size={84} className="pointer-events-none absolute -bottom-4 -end-3 -rotate-12 opacity-[0.16]" />
        <div className="relative flex items-center gap-2 text-ink-2"><Icon icon={icon} size={17} /><span className="text-xs sm:text-sm font-semibold leading-snug">{label}</span></div>
        <p className="relative mt-3 font-display text-3xl font-bold leading-none text-ink num">{fmt(value)}</p>
      </article>)}
    </section>

    <section className="mt-6 card p-4 sm:p-5" aria-labelledby="trend-title">
      <h2 id="trend-title" className="font-display text-lg font-bold text-ink">النشاط اليومي</h2>
      <p className="mt-1 text-sm text-ink-3">كل عمود يجمع أحداثًا مسجّلة في قاعدة البيانات ضمن الفلاتر المختارة.</p>
      {data.trends.length === 0 ? <EmptyState compact illustration="inbox" title="لا يوجد نشاط في هذه المدة" /> : <div className="mt-5 flex overflow-x-auto pb-2" role="list" aria-label="عدد الأنشطة يوميًا">{data.trends.map((item) => <div key={item.date} role="listitem" className="w-12 shrink-0 text-center"><div className="h-40 flex items-end justify-center" style={{ backgroundImage: GRID_LINES }}><div className="w-7 rounded-t-xl transition-[height] duration-700" style={{ height: `${Math.max(5, (item.activities / trendMax) * 100)}%`, background: item.activities === trendMax ? "var(--gold)" : "var(--primary)" }} title={`${item.activities} نشاط`} /></div><p className="mt-1 text-[10px] text-ink-3 num" dir="ltr">{item.date.slice(5)}</p><p className="text-[10px] text-ink-2 num">{item.activities}</p></div>)}</div>}
    </section>

    <section className="mt-6" aria-labelledby="course-stats-title">
      <h2 id="course-stats-title" className="mb-3 font-display text-lg font-bold text-ink">إحصاءات الكورسات</h2>
      {data.courses.length === 0 ? <EmptyState illustration="book" title="لا توجد كورسات في هذا النطاق" /> : <div className="grid lg:grid-cols-2 gap-3">{data.courses.map((course) => <article key={course.courseId} className="card card-interactive p-5 min-w-0"><h3 className="font-bold text-ink break-words">{course.title}</h3><dl className="mt-4 grid grid-cols-3 gap-2 text-center">{[
            ["طلاب", fmt(course.students)], ["نشطون", fmt(course.activeStudents)], ["مشاهدات", fmt(course.videoViews)],
            ["إكمال الدروس", fmt(course.lessonCompletions)], ["متوسط الاختبار", course.averageExamPercent == null ? "—" : `${fmt(course.averageExamPercent)}%`], ["متوسط الواجب", fmt(course.averageHomeworkGrade)],
          ].map(([label, value]) => <div key={label} className="flex flex-col-reverse rounded-xl bg-sunken py-2.5"><dt className="mt-1.5 text-[11px] text-ink-3">{label}</dt><dd className="num text-lg font-bold leading-none text-ink">{value}</dd></div>)}</dl></article>)}</div>}
    </section>

    <section className="mt-6" aria-labelledby="attention-title">
      <h2 id="attention-title" className="mb-1 font-display text-lg font-bold text-ink">طلاب بلا نشاط في المدة</h2><p className="mb-3 text-sm text-ink-3">القائمة مرتبة بالأقدم نشاطًا. راجعهم قبل اعتبار غياب النشاط مشكلة.</p>
      {data.studentsNeedingAttention.length === 0 ? <EmptyState compact illustration="check" title="كل الطلاب لديهم نشاط مسجّل في الفترة." /> : <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger">{data.studentsNeedingAttention.map((student) => <li key={student.id} className="card flex items-center gap-3.5 p-4" style={{ borderInlineStartWidth: 4, borderInlineStartColor: "var(--warn-solid)" }}>
        <Avatar name={student.fullName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{student.fullName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{student.grade && <Badge tone="primary">{student.grade}</Badge>}{student.group && <Badge>{student.group}</Badge>}</div>
          <p className="mt-1.5 text-xs text-ink-3 num">{student.lastActiveAt ? `آخر دخول: ${new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(student.lastActiveAt))}` : "لم يسجّل دخولًا"}</p>
        </div>
      </li>)}</ul>}
    </section>

    <section className="mt-6" aria-labelledby="student-breakdown-title">
      <h2 id="student-breakdown-title" className="mb-1 font-display text-lg font-bold text-ink">ملخص كل طالب</h2>
      <p className="mb-3 text-sm text-ink-3">المقاييس ضمن الفترة والكورس المحددين، والطلاب محصورون في حساباتك فقط.</p>
      {data.students.length === 0 ? <EmptyState compact illustration="users" title="لا توجد بيانات طلاب ضمن الفلاتر." /> : <ul className="grid lg:grid-cols-2 gap-3 stagger">{data.students.map((student) => <li key={student.id} className="card p-4 min-w-0">
        <div className="flex items-center gap-3.5">
          <Avatar name={student.fullName} />
          <div className="min-w-0"><p className="truncate font-bold text-ink">{student.fullName}</p><p className="text-xs text-ink-3">{student.grade}{student.group ? ` · ${student.group}` : ""}</p></div>
        </div>
        <dl className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">{[
          ["الكورسات", fmt(student.courses)], ["إكمال الدروس", fmt(student.lessonCompletions)], ["محاولات الاختبار", fmt(student.examAttempts)],
          ["متوسط الاختبارات", student.averageExamPercent == null ? "—" : `${fmt(student.averageExamPercent)}%`], ["تسليمات الواجب", fmt(student.homeworkSubmissions)],
          ["مشاهدات الفيديو", fmt(student.videoViews)], ["الحضور", `${fmt(student.attendedSessions)} · ${fmt(student.attendanceMinutes)} د`],
        ].map(([label, value]) => <div key={label} className="flex flex-col-reverse rounded-xl bg-sunken px-1 py-2"><dt className="mt-1 text-[10px] leading-tight text-ink-3">{label}</dt><dd className="num text-sm font-bold text-ink">{value}</dd></div>)}</dl>
      </li>)}</ul>}
    </section>
  </>;
}
