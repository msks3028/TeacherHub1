import CountUp from "./CountUp";

const TILE = {
  primary: ["var(--primary-soft)", "var(--primary-ink)"], ok: ["var(--ok-bg)", "var(--ok)"], warn: ["var(--warn-bg)", "var(--warn)"],
  bad: ["var(--bad-bg)", "var(--bad)"], info: ["var(--info-bg)", "var(--info)"],
  video: ["var(--t-video-bg)", "var(--t-video)"], homework: ["var(--t-homework-bg)", "var(--t-homework)"],
  exam: ["var(--t-exam-bg)", "var(--t-exam)"], file: ["var(--t-file-bg)", "var(--t-file)"], note: ["var(--t-note-bg)", "var(--t-note)"],
};

/** A row of tinted figures. items: [{ label, value, tone }] — value may be a number (it counts up) or text. */
export default function StatStrip({ items, className = "" }) {
  return (
    <dl className={`grid gap-3 ${items.length === 2 ? "grid-cols-2" : items.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"} ${className}`}>
      {items.map((it) => {
        const [bg, fg] = TILE[it.tone || "primary"];
        return (
          <div key={it.label} className="flex min-w-0 flex-col-reverse rounded-2xl px-4 py-3.5" style={{ background: bg, color: fg }}>
            <dt className="mt-1.5 text-xs font-semibold leading-snug text-ink-2">{it.label}</dt>
            <dd className="num font-display text-2xl font-bold leading-none text-ink"><CountUp value={it.value} /></dd>
          </div>
        );
      })}
    </dl>
  );
}
