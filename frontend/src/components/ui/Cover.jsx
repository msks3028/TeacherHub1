import { useMemo } from "react";
import Icon from "./Icon";

function hash(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A cover drawn from SVG (no image downloads): a colour + a notebook-style
 * pattern picked from the title, so every course/video looks distinct but
 * stays on-brand. Pass `src` to show a real image instead.
 */
export default function Cover({ seed = "", src, icon, ratio = "16 / 9", className = "", iconSize = 32 }) {
  const h = useMemo(() => hash(seed), [seed]);
  const palette = h % 6;
  const pattern = Math.floor(h / 7) % 4;
  const id = `cv-${h}`;

  return (
    <div className={`relative overflow-hidden cover-${palette} ${className}`} style={{ aspectRatio: ratio, background: "var(--cv-bg)", color: "var(--cv-fg)" }}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <>
          <svg className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            <defs>
              {pattern === 0 && (
                <pattern id={id} width="100%" height="22" patternUnits="userSpaceOnUse"><line x1="0" y1="21" x2="100%" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.25" /></pattern>
              )}
              {pattern === 1 && (
                <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="currentColor" opacity="0.3" /></pattern>
              )}
              {pattern === 2 && (
                <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" /></pattern>
              )}
              {pattern === 3 && (
                <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="26" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.22" /><circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.22" /></pattern>
              )}
            </defs>
            <rect width="100%" height="100%" fill={`url(#${id})`} />
          </svg>
          {icon && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid place-items-center w-14 h-14 rounded-full bg-raised shadow-1"><Icon icon={icon} size={iconSize} /></span>
            </span>
          )}
        </>
      )}
    </div>
  );
}
