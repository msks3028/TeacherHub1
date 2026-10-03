import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Icon from "./Icon";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Only the top-most dialog reacts to Esc (dialogs can be nested, e.g. grading inside submissions).
const stack = [];

/**
 * Bottom sheet on phones, centred dialog on desktop.
 * Esc / outside-click close it, focus is trapped inside, and focus returns to
 * whatever opened it. `footer` stays pinned at the bottom (keep primary actions there).
 */
export default function Modal({ open, onClose, title, description, children, footer, wide = false, size, dismissable = true }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const token = {};
    stack.push(token);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => {
      const el = panelRef.current;
      if (!el) return;
      const first = el.querySelector("[data-autofocus]") || el.querySelector('input:not([type="hidden"]):not([type="file"]),textarea,select');
      (first || el).focus({ preventScroll: true });
    }, 40);

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        closeRef.current?.();
      }
      if (e.key === "Tab") {
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (nodes.length === 0) { e.preventDefault(); return; }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, dismissable]);

  if (!open) return null;

  return createPortal(
    <div className="modal-root">
      <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissable) onClose?.(); }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-size={size || (wide ? "wide" : undefined)}
        className="modal-panel"
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl font-bold text-ink leading-snug">{title}</h2>
            {description && <p id={descId} className="text-sm text-ink-3 mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="btn btn-ghost btn-icon btn-sm -me-1.5 shrink-0">
            <Icon icon={X} size={20} />
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-line shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-raised rounded-b-[inherit]">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
