import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

/* ---------------------------------------------------------------- skeletons */
export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5" aria-hidden="true">
      <Skeleton className="w-11 h-11 !rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

/**
 * Loading placeholder shaped like the content that is coming (not a blank spinner).
 * variant: list | grid | page | stats
 */
export function LoadingState({ label = "جارِ التحميل...", variant = "page", rows = 5 }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {variant === "page" && (
        <div className="space-y-6" aria-hidden="true">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="panel divide-soft overflow-hidden">
            {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      )}
      {variant === "list" && (
        <div className="panel divide-soft overflow-hidden" aria-hidden="true">
          {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}
      {variant === "grid" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <Skeleton className="!rounded-none aspect-video" />
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
      {variant === "stats" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- illustrations */
const stroke = { fill: "none", stroke: "var(--line-strong)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" };

const ART = {
  inbox: (
    <>
      <ellipse cx="80" cy="106" rx="50" ry="6" fill="var(--sunken)" />
      <path d="M32 64 L48 30 H112 L128 64 V92 a6 6 0 0 1-6 6 H38 a6 6 0 0 1-6-6 Z" fill="var(--surface)" {...stroke} />
      <path d="M32 64 H60 a4 4 0 0 1 4 4 a16 16 0 0 0 32 0 a4 4 0 0 1 4-4 H128" {...stroke} />
      <path d="M62 44 H98 M68 54 H92" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </>
  ),
  book: (
    <>
      <ellipse cx="80" cy="106" rx="50" ry="6" fill="var(--sunken)" />
      <path d="M80 36 C64 26 40 26 26 32 V92 C40 86 64 86 80 96 C96 86 120 86 134 92 V32 C120 26 96 26 80 36 Z" fill="var(--surface)" {...stroke} />
      <path d="M80 36 V96" {...stroke} />
      <path d="M40 46 H68 M40 58 H68 M40 70 H62 M92 46 H120 M92 58 H120 M92 70 H114" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </>
  ),
  check: (
    <>
      <ellipse cx="80" cy="106" rx="46" ry="6" fill="var(--sunken)" />
      <circle cx="80" cy="60" r="34" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="2.5" />
      <path d="M64 61 L76 73 L98 48" fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M126 28 l0 10 M121 33 l10 0 M30 40 l0 8 M26 44 l8 0" stroke="var(--pen)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  search: (
    <>
      <ellipse cx="80" cy="106" rx="46" ry="6" fill="var(--sunken)" />
      <circle cx="72" cy="54" r="28" fill="var(--surface)" {...stroke} />
      <path d="M93 75 L116 98" stroke="var(--line-strong)" strokeWidth="7" strokeLinecap="round" />
      <path d="M60 54 H84 M66 64 H78" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </>
  ),
  file: (
    <>
      <ellipse cx="80" cy="106" rx="42" ry="6" fill="var(--sunken)" />
      <path d="M52 22 H92 L112 42 V92 a6 6 0 0 1-6 6 H52 a6 6 0 0 1-6-6 V28 a6 6 0 0 1 6-6 Z" fill="var(--surface)" {...stroke} />
      <path d="M92 22 V42 H112" {...stroke} />
      <path d="M58 60 H100 M58 72 H100 M58 84 H84" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </>
  ),
};

export function Illustration({ name = "inbox", className = "w-40 h-28" }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="presentation" aria-hidden="true">
      {ART[name] || ART.inbox}
    </svg>
  );
}

/* ---------------------------------------------------------------- empty / error */
export function EmptyState({ title, message = "لا يوجد بيانات لعرضها حاليًا.", action, illustration = "inbox", compact = false, className = "" }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-8" : "py-14"} px-4 anim-rise ${className}`}>
      <Illustration name={illustration} className={compact ? "w-28 h-20" : "w-40 h-28"} />
      {title && <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>}
      <p className={`${title ? "mt-1" : "mt-3"} text-sm text-ink-2 max-w-sm`}>{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className = "" }) {
  const offline = !message || /server|connection|reach/i.test(message);
  return (
    <div role="alert" className={`flex flex-col items-center text-center py-14 px-4 anim-rise ${className}`}>
      <span className="ct ct-lg ct-bad !rounded-full"><Icon icon={offline ? WifiOff : AlertTriangle} size={24} /></span>
      <h3 className="mt-4 text-lg font-bold text-ink">حصلت مشكلة</h3>
      <p className="mt-1 text-sm text-ink-2 max-w-sm">{message || "حدث خطأ غير متوقع. حاول مرة أخرى."}</p>
      {onRetry && <Button className="mt-5" variant="secondary" icon={RefreshCw} onClick={onRetry}>إعادة المحاولة</Button>}
    </div>
  );
}
