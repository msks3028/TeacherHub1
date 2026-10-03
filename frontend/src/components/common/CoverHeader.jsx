import { useId } from "react";
import { Link } from "react-router-dom";
import Icon, { ArrowForward } from "../ui/Icon";

/**
 * The notebook cover that opens a page: ruled lines, the red margin line, an eyebrow, a title
 * and room for actions and a few figures. Display only — pages pass in whatever they already show.
 */
export default function CoverHeader({ eyebrow, title, description, actions, stats = [], back, children, className = "" }) {
  const id = `cover-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <header className={`relative mb-6 overflow-hidden rounded-3xl bg-sidebar text-sidebar-ink ${className}`} style={{ "--ring": "var(--sb-ink)" }}>
      <svg className="absolute inset-0 h-full w-full text-sidebar-ink opacity-[0.07]" aria-hidden="true">
        <defs><pattern id={id} width="100%" height="36" patternUnits="userSpaceOnUse"><line x1="0" y1="35" x2="100%" y2="35" stroke="currentColor" strokeWidth="1.5" /></pattern></defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      <div className="absolute inset-y-0 start-7 w-px bg-pen opacity-60" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 p-6 ps-12 md:flex-row md:items-end md:justify-between md:p-8 md:ps-16">
        <div className="min-w-0">
          {back && (
            <Link to={back.to} className="mb-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-sidebar-hover px-3.5 text-xs font-bold text-sidebar-ink transition-colors hover:bg-sidebar-active">
              <Icon icon={ArrowForward} size={14} />{back.label}
            </Link>
          )}
          {eyebrow && <p className="text-sm font-semibold text-sidebar-ink2">{eyebrow}</p>}
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight break-words md:text-4xl">{title}</h1>
          {description && <p className="mt-2.5 max-w-xl text-sidebar-ink2 break-words">{description}</p>}
          {children}
        </div>
        {(stats.length > 0 || actions) && (
          <div className="flex flex-col gap-3 md:items-end">
            {stats.length > 0 && (
              <dl className="flex flex-wrap gap-2">
                {stats.map((st) => (
                  <div key={st.label} className="flex min-w-[84px] flex-col-reverse rounded-2xl bg-sidebar-hover px-4 py-2.5 text-center">
                    <dt className="mt-1 text-xs text-sidebar-ink2">{st.label}</dt>
                    <dd className="num text-xl font-bold leading-none">{st.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="flex flex-wrap gap-2 [&_.btn-secondary]:border-transparent">{actions}</div>}
          </div>
        )}
      </div>
    </header>
  );
}
