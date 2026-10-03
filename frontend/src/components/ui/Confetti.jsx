import { useEffect, useState } from "react";

const COLORS = ["var(--primary)", "var(--pen)", "var(--warn-solid)", "var(--info-solid)", "var(--ok-solid)", "var(--t-file)"];
const COUNT = 28;

/**
 * One-off celebration. Pure CSS pieces, no library, removed after ~4s.
 * `onceKey` makes it play a single time per key (stored in localStorage; if
 * storage is unavailable it simply plays). Skipped entirely for reduced motion.
 */
export default function Confetti({ onceKey }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (onceKey) {
      try {
        if (localStorage.getItem(onceKey)) return undefined;
        localStorage.setItem(onceKey, "1");
      } catch { /* storage unavailable: just play */ }
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(t);
  }, [onceKey]);

  if (!show) return null;
  return (
    <div className="confetti-layer" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            "--x": `${(i * 37) % 100}%`,
            "--dx": `${((i % 7) - 3) * 26}px`,
            "--rot": `${360 + ((i * 53) % 540)}deg`,
            "--d": `${2.2 + ((i * 13) % 14) / 10}s`,
            "--delay": `${((i * 29) % 60) / 100}s`,
            "--w": `${6 + (i % 3) * 2}px`,
            "--h": `${10 + (i % 4) * 2}px`,
            "--c": COLORS[i % COLORS.length],
          }}
        />
      ))}
    </div>
  );
}
