import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import PageHeader from "../../components/ui/PageHeader";
import { fmtDateTime } from "../../lib/format";

const NOTE_COLORS = ["var(--t-homework-bg)", "var(--t-note-bg)", "var(--t-video-bg)", "var(--t-exam-bg)", "var(--t-file-bg)"];
const NOTE_TILT = [-1.2, 0.9, -0.6, 1.4];

export default function StudentAnnouncementsPage() {
  const { data, loading, error, refetch } = useApi("/student/announcements");

  if (loading) return <LoadingState variant="list" label="جارِ تحميل الإعلانات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="الإعلانات" description="أخبار وتنبيهات من مدرسك." />
      {data.announcements.length === 0 ? (
        <EmptyState illustration="inbox" title="مفيش إعلانات" message="لا يوجد إعلانات حاليًا." />
      ) : (
        <ul className="grid gap-x-5 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {data.announcements.map((a, i) => (
            <li key={a.id} className="relative">
              <span className="absolute -top-2 inset-x-0 mx-auto z-10 block h-4 w-4 rounded-full bg-pen shadow-2 ring-2 ring-[var(--surface)]" aria-hidden="true" />
              <article
                className="flex min-h-[176px] flex-col rounded-xl p-5 pt-7 shadow-2 transition-transform duration-300 [transform:rotate(var(--r))] hover:[transform:rotate(0deg)]"
                style={{ "--r": `${NOTE_TILT[i % NOTE_TILT.length]}deg`, background: NOTE_COLORS[i % NOTE_COLORS.length] }}
              >
                <h2 className="font-bold text-ink text-lg leading-snug break-words">{a.title}</h2>
                <p className="mt-2 flex-1 text-ink-2 whitespace-pre-wrap break-words leading-relaxed">{a.body}</p>
                <p className="mt-4 text-xs text-ink-2 num">{fmtDateTime(a.createdAt)}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
