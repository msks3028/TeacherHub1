import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState } from "../../components/common/StateViews";
import CoverHeader from "../../components/common/CoverHeader";
import StatStrip from "../../components/ui/StatStrip";
import StudentHomeworkList from "../../components/homework/StudentHomeworkList";

const FILTERS = [["all", "الكل"], ["pending", "لسه ماتسلّمتش"], ["done", "تم تسليمها"]];

export default function StudentHomeworkPage() {
  const { data, loading, error, refetch } = useApi("/student/homework");
  const [filter, setFilter] = useState("all");

  if (loading) return <LoadingState label="جارِ تحميل الواجبات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const all = data.homework;
  const pending = all.filter((h) => !h.mySubmission);
  const graded = all.filter((h) => h.mySubmission?.status === "GRADED");
  const submitted = all.filter((h) => h.mySubmission && h.mySubmission.status !== "GRADED");
  const shown = filter === "pending" ? pending : filter === "done" ? all.filter((h) => h.mySubmission) : all;

  return (
    <>
      <CoverHeader eyebrow="الواجبات" title="واجباتك" description="سلّم واجباتك قبل الموعد، وتابع درجاتك وملاحظات المدرس." />
      {all.length > 0 && (
        <div className="mb-6 space-y-4">
          <StatStrip items={[{ label: "مطلوب منك", value: pending.length, tone: "homework" }, { label: "تم التسليم", value: submitted.length, tone: "info" }, { label: "اتصحّح", value: graded.length, tone: "ok" }]} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية الواجبات">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
                className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition-colors ${filter === key ? "bg-primary text-primary-on" : "bg-sunken text-ink-2 hover:bg-primary-soft"}`}>{label}</button>
            ))}
          </div>
        </div>
      )}
      <StudentHomeworkList homework={shown} onChanged={refetch} emptyMessage={filter === "all" ? undefined : "مفيش واجبات في التصنيف ده."} />
    </>
  );
}
