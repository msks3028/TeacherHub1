import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Icon from "./Icon";

const MAP = {
  info: ["bg-info-bg text-info", Info],
  ok: ["bg-ok-bg text-ok", CheckCircle2],
  warn: ["bg-warn-bg text-warn", AlertTriangle],
  bad: ["bg-bad-bg text-bad", AlertCircle],
};

/** Inline message. tone: info | ok | warn | bad. `action` renders on the end side. */
export default function Alert({ tone = "info", title, children, action, className = "", role }) {
  const [cls, I] = MAP[tone] || MAP.info;
  return (
    <div role={role || (tone === "bad" ? "alert" : "status")} className={`flex items-start gap-3 rounded p-3.5 ${cls} ${className}`}>
      <Icon icon={I} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
