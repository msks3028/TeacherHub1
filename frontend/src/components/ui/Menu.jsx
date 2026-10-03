import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import Icon from "./Icon";

/**
 * Popover menu rendered in a portal (so table wrappers never clip it).
 * items: [{ label, icon, onClick, danger, hidden, separatorBefore }]
 * Use `trigger` (render prop) for a custom button, or leave it for the ⋮ button.
 */
export default function Menu({ items, label = "المزيد من الإجراءات", trigger, header, width }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    let left = rtl ? r.left : r.right - m.width; // align the menu's end edge with the trigger's end edge
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    let top = r.bottom + 6;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 6);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector(".menu-item")?.focus();
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const nodes = [...menuRef.current.querySelectorAll(".menu-item")];
        const i = nodes.indexOf(document.activeElement);
        nodes[(i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length]?.focus();
      }
      if (e.key === "Tab") close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      {trigger ? (
        trigger({ ref: btnRef, onClick: () => setOpen((o) => !o), "aria-haspopup": "menu", "aria-expanded": open })
      ) : (
        <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} className="btn btn-ghost btn-icon btn-sm">
          <Icon icon={MoreVertical} size={20} />
        </button>
      )}
      {open &&
        createPortal(
          <div ref={menuRef} role="menu" className="menu" style={{ top: pos.top, left: pos.left, width, maxHeight: "70dvh", overflowY: "auto" }}>
            {header}
            {visible.map((it, i) => (
              <div key={it.key || it.label + i}>
                {it.separatorBefore && i > 0 && <div className="menu-sep" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  aria-label={it.label}
                  data-danger={it.danger || undefined}
                  onClick={() => { close(false); it.onClick?.(); }}
                >
                  {it.content || (
                    <>
                      {it.icon && <Icon icon={it.icon} size={16} className="shrink-0" />}
                      {it.label}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
