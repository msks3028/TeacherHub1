import Icon from "./Icon";

/** tone: neutral | primary | ok | warn | bad | info */
export default function Badge({ tone = "neutral", icon, dot = false, children, className = "" }) {
  const t = tone === "neutral" ? "" : `badge-${tone}`;
  return (
    <span className={`badge ${t} ${dot ? "badge-dot" : ""} ${className}`}>
      {icon && <Icon icon={icon} size={14} />}
      {children}
    </span>
  );
}
