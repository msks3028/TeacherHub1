import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import ContentIcon from "../../components/ui/ContentIcon";
import Confetti from "../../components/ui/Confetti";
import { ProgressBar, ProgressRing, ScoreMark } from "../../components/ui/Progress";
import { fmtDateTime, fmtNumber, percent } from "../../lib/format";

export default function StudentResultsPage() {
  const { data, loading, error, refetch } = useApi("/student/results");

  if (loading) return <LoadingState label="جارِ تحميل النتائج..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const results = [...data.results].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const avg = results.length ? Math.round(results.reduce((s, r) => s + percent(r.score, r.maxScore), 0) / results.length) : null;
  const passedCount = results.filter((r) => r.passed === true).length;

  const latest = results[0];
  const celebrate = latest && latest.passed !== false && percent(latest.score, latest.maxScore) >= 90;

  return (
    <>
      {celebrate && <Confetti onceKey={`th-celebrated-${latest.id}`} />}
      <PageHeader title="النتائج" description="درجات اختباراتك من الأحدث للأقدم." />
      {results.length === 0 ? (
        <EmptyState illustration="file" title="لسه مفيش نتائج" message="أول ما تخلّص اختبار وتتصحّح هتلاقي نتيجته هنا." />
      ) : (
        <div className="space-y-6">
          <section className="panel p-5 flex items-center gap-5" aria-label="ملخص النتائج">
            <ProgressRing value={avg} size={92} stroke={9} tone={avg >= 50 ? "ok" : "warn"} label={`متوسط النتائج ${avg}%`}>
              <span className="num text-xl font-bold text-ink">{avg}%</span>
            </ProgressRing>
            <div>
              <p className="font-bold text-ink text-lg">متوسط نتايجك</p>
              <p className="text-sm text-ink-2 mt-0.5 num">{fmtNumber(results.length)} اختبار، نجحت في {fmtNumber(passedCount)}</p>
            </div>
          </section>

          <ul className="space-y-3 stagger">
            {results.map((r) => {
              const pct = percent(r.score, r.maxScore);
              return (
                <li key={r.id} className="card p-4 md:p-5">
                  <div className="flex items-center gap-3.5">
                    <ContentIcon type="exam" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink">{r.exam.title}</h3>
                        {r.passed !== null && <Badge tone={r.passed ? "ok" : "warn"}>{r.passed ? "ناجح" : "راسب"}</Badge>}
                      </div>
                      <p className="text-xs text-ink-3 mt-1 num">{fmtDateTime(r.submittedAt)}</p>
                    </div>
                    <ScoreMark score={r.score} max={r.maxScore} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar value={pct} tone={r.passed === false ? "warn" : "ok"} label={`${pct}%`} className="flex-1" />
                    <span className="num text-sm font-bold text-ink-2 w-11 text-end">{pct}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
