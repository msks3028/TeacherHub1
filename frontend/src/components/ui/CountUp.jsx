import { useEffect, useState } from "react";

const prefersReduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts a whole number up from 0 once, then shows the real value.
 * Anything that is not a plain number (strings, "-", undefined) is shown as-is,
 * so it is always safe to wrap a figure in it.
 */
export default function CountUp({ value, duration = 800, format }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const animate = isNum && Number.isInteger(value) && value > 0 && !prefersReduced();
  const [shown, setShown] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) { setShown(value); return undefined; }
    let raf;
    let start;
    const tick = (t) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate, duration]);

  if (!isNum) return format ? format(value) : (value ?? null);
  return <>{format ? format(shown) : shown}</>;
}
