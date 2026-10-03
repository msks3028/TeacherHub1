import { CONTENT_TYPES } from "../../constants/contentTypes";
import Icon from "./Icon";

export default function ContentIcon({ type, size = "md", className = "" }) {
  const t = CONTENT_TYPES[type] || CONTENT_TYPES.file;
  const box = size === "sm" ? "ct-sm" : size === "lg" ? "ct-lg" : "";
  return (
    <span className={`ct ${t.cls} ${box} ${className}`} aria-hidden="true">
      <Icon icon={t.icon} size={size === "sm" ? 16 : size === "lg" ? 24 : 20} />
    </span>
  );
}
