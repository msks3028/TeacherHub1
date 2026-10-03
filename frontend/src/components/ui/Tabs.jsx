import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * tabs: [{ key, label, count?, icon? }]  — value is the active key.
 * A sliding indicator follows the active tab; the strip scrolls sideways on phones.
 */
export default function Tabs({ tabs, value, onChange, idPrefix = "tab", className = "" }) {
  const rowRef = useRef(null);
  const refs = useRef({});
  const [bar, setBar] = useState(null);

  const measure = () => {
    const el = refs.current[value];
    if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
  };

  useLayoutEffect(measure, [value, tabs.map((t) => `${t.key}:${t.count ?? ""}`).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureRef = useRef(measure);
  measureRef.current = measure;
  useEffect(() => {
    if (!rowRef.current || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measureRef.current());
    ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    refs.current[value]?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [value]);

  function onKeyDown(e) {
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = rtl ? "ArrowRight" : "ArrowLeft";
    const i = tabs.findIndex((t) => t.key === value);
    let n = null;
    if (e.key === nextKey) n = (i + 1) % tabs.length;
    else if (e.key === prevKey) n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n !== null) {
      e.preventDefault();
      onChange(tabs[n].key);
      refs.current[tabs[n].key]?.focus();
    }
  }

  return (
    <div className={`tabs ${className}`}>
      <div className="tabs-row" role="tablist" ref={rowRef} onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.key}
            ref={(el) => { refs.current[t.key] = el; }}
            id={`${idPrefix}-${t.key}`}
            type="button"
            role="tab"
            aria-selected={value === t.key}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            tabIndex={value === t.key ? 0 : -1}
            className="tab"
            onClick={() => onChange(t.key)}
          >
            {t.icon && <Icon icon={t.icon} size={16} />}
            {t.label}
            {t.count !== undefined && t.count !== null && <span className="tab-count num">{t.count}</span>}
          </button>
        ))}
        <span
          className="tab-indicator"
          aria-hidden="true"
          style={bar ? { transform: `translateX(${bar.x}px)`, width: bar.w } : { opacity: 0 }}
        />
      </div>
    </div>
  );
}

/** Wrap a tab's content so screen readers link it to its tab. */
export function TabPanel({ id, idPrefix = "tab", children, className = "" }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-${id}`} className={`anim-rise ${className}`} tabIndex={0}>
      {children}
    </div>
  );
}
