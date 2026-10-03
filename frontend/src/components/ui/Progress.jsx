import { useEffect, useState } from "react";

/** Starts at 0 and eases to the real value after first paint so bars and rings visibly fill. */
function useGrow(target) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setV(target)));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return v;
}

/** tone: primary | ok | warn | bad | info */
const FILL = { primary: "bg-primary", ok: "bg-ok-solid", warn: "bg-warn-solid", bad: "bg-bad-solid", info: "bg-info-solid" };
const STROKE = { primary: "var(--primary)", ok: "var(--ok-solid)", warn: "var(--warn-solid)", bad: "var(--bad-solid)", info: "var(--info-solid)" };

export function ProgressBar({ value = 0, max = 100, tone = "primary", label, className = "" }) {
  const target = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const pct = useGrow(target);
  return (
    <div
      className={`h-2 rounded-full bg-sunken overflow-hidden ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${FILL[tone] || FILL.primary}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Circular percentage. Children render in the middle. */
export function ProgressRing({ value = 0, size = 72, stroke = 7, tone = "primary", children, label, className = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = useGrow(Math.max(0, Math.min(100, value)));
  return (
    <div className={`relative inline-grid place-items-center shrink-0 ${className}`} style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(pct)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={STROKE[tone] || STROKE.primary} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.9s var(--ease)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">{children}</div>
    </div>
  );
}

/**
 * The signature: a score circled in the teacher's red pen.
 * The ring is a slightly imperfect hand-drawn loop that draws itself once.
 */
export function ScoreMark({ score, max, size = "md", className = "" }) {
  const dims = { sm: [76, 42, "text-sm"], md: [116, 62, "text-lg"], lg: [156, 84, "text-2xl"] }[size];
  const [w, h, text] = dims;
  return (
    <span className={`relative inline-grid place-items-center shrink-0 stamp-in ${className}`} style={{ width: w, height: h }} role="img" aria-label={max != null ? `الدرجة ${score} من ${max}` : `الدرجة ${score}`}>
      <svg viewBox="0 0 116 62" width={w} height={h} className="absolute inset-0 text-pen" aria-hidden="true" fill="none">
        <path
          pathLength="1"
          className="pen-draw"
          d="M14 36 C 8 16, 42 5, 72 7 C 101 9, 112 28, 92 46 C 68 60, 22 56, 11 38 C 6 27, 18 15, 42 10"
          stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <span className={`relative num font-bold text-ink ${text}`} dir="ltr">
        {score}{max != null && <span className="text-ink-3 font-medium">/{max}</span>}
      </span>
    </span>
  );
}
