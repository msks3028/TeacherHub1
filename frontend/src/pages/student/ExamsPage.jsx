import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState } from "../../components/common/StateViews";
import CoverHeader from "../../components/common/CoverHeader";
import StatStrip from "../../components/ui/StatStrip";
import StudentExamsList from "../../components/exam/StudentExamsList";
import { fmtDate } from "../../lib/format";

export default function StudentExamsPage() {
  const { data, loading, error, refetch } = useApi("/student/exams");

  if (loading) return <LoadingState label="جارِ تحميل الاختبارات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const exams = data.exams;
  const upcoming = exams.map((ex) => ex.endDate).filter((d) => d && new Date(d) > new Date()).sort((a, b) => new Date(a) - new Date(b))[0];

  return (
    <>
      <CoverHeader eyebrow="الاختبارات" title="اختباراتك" description="الاختبارات المتاحة ليك ونتايجك السابقة." />
      {exams.length > 0 && (
        <StatStrip className="mb-6" items={[{ label: "اختبار متاح", value: exams.length, tone: "exam" }, { label: "أقرب موعد انتهاء", value: upcoming ? fmtDate(upcoming) : "-", tone: "warn" }]} />
      )}
      <StudentExamsList exams={exams} onChanged={refetch} />
    </>
  );
}
