/**
 * Small, dependency-free charts (plain HTML/SVG). Numbers run left → right
 * (low → high) even in an RTL page, the way readers expect a numeric axis.
 */
export function BarChart({ data, height = 140, className = "", ariaLabel = "رسم بياني" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={className} dir="ltr" role="img" aria-label={ariaLabel}>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5">
            <span className="num text-xs font-bold text-ink-2">{d.value}</span>
            <div
              className="w-full rounded-t-sm transition-[height] duration-500 ease-out"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 6 : 3, background: d.value ? (d.color || "var(--primary)") : "var(--line-strong)" }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-3 mt-2 border-t border-line pt-2">
        {data.map((d) => <span key={d.label} className="flex-1 min-w-0 text-center num text-[11px] sm:text-xs text-ink-3 truncate">{d.label}</span>)}
      </div>
    </div>
  );
}
