import { hueFromString } from "../../lib/theme";

/** Initial on a colour that is stable per name. Uses the photo when there is one. */
export default function Avatar({ name = "", src, size = "md", className = "" }) {
  const initial = name.trim()[0]?.toUpperCase() || "؟";
  const s = size === "sm" ? "avatar-sm" : size === "lg" ? "avatar-lg" : "";
  return (
    <span className={`avatar ${s} ${className}`} style={{ "--h": hueFromString(name) }} aria-hidden="true">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initial}
    </span>
  );
}
