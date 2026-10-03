import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp } from "lucide-react";
import Icon, { ChevronForward } from "./Icon";
import ContentIcon from "./ContentIcon";
import CountUp from "./CountUp";

export default function Card({ as: As = "div", interactive = false, className = "", children, ...props }) {
  return (
    <As className={`card ${interactive ? "card-interactive" : ""} ${className}`} {...props}>
      {children}
    </As>
  );
}

const TONE = {
  primary: "ct-primary", video: "ct-video", homework: "ct-homework", exam: "ct-exam", file: "ct-file", note: "ct-note",
  ok: "ct-ok", warn: "ct-warn", bad: "ct-bad", info: "ct-info", neutral: "ct-neutral",
  green: "ct-ok", orange: "ct-homework", red: "ct-bad", blue: "ct-video",
};

/** A single figure with a label. `trend` is optional: { dir: "up" | "down", text } */
export function StatCard({ label, value, hint, icon, tone = "primary", to, trend, className = "" }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2 font-medium">{label}</p>
        {icon && <span className={`ct ct-sm ${TONE[tone] || TONE.primary}`}><Icon icon={icon} size={16} /></span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-ink num leading-tight"><CountUp value={value} /></p>
      {trend && (
        <p className={`mt-1 text-xs font-semibold inline-flex items-center gap-1 ${trend.dir === "down" ? "text-bad" : "text-ok"}`}>
          <Icon icon={trend.dir === "down" ? TrendingDown : TrendingUp} size={16} /> {trend.text}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </>
  );
  const cls = `card p-5 block ${to ? "card-interactive" : ""} ${className}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/**
 * One line of content (video / homework / exam / file / announcement):
 * type icon · title + meta · trailing slot. Renders as a link when `to` is set.
 */
export function ContentRow({ type = "file", title, meta, end, to, onClick, className = "", children }) {
  const inner = (
    <>
      <ContentIcon type={type} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink truncate">{title}</p>
        {meta && <div className="text-sm text-ink-3 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">{meta}</div>}
        {children}
      </div>
      {end && <div className="shrink-0 flex items-center gap-2">{end}</div>}
      {(to || onClick) && !end && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-2 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:bg-primary group-hover:text-primary-on">
          <Icon icon={ChevronForward} size={16} />
        </span>
      )}
    </>
  );
  const base = `group flex items-center gap-4 px-4 py-4 text-start w-full ${className}`;
  if (to) return <Link to={to} className={`${base} transition-colors hover:bg-sunken`}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${base} transition-colors hover:bg-sunken`}>{inner}</button>;
  return <div className={base}>{inner}</div>;
}

/** Bordered container for a list of ContentRows (rows are divided, not carded). */
export function RowList({ children, className = "" }) {
  return <div className={`panel divide-soft overflow-hidden ${className}`}>{children}</div>;
}
