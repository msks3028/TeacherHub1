import { forwardRef, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Eye, EyeOff, File as FileIcon, Film, Search, UploadCloud, X } from "lucide-react";
import Icon from "./Icon";
import { fmtSize } from "../../lib/format";

/* ------------------------------------------------------------------ shell */
export function Field({ id, label, hint, error, success, required, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-bad ms-1" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-msg`} className="field-error" role="alert">
          <Icon icon={AlertCircle} size={16} className="mt-[3px] shrink-0" />
          <span>{error}</span>
        </p>
      ) : success ? (
        <p id={`${id}-msg`} className="field-ok">
          <Icon icon={CheckCircle2} size={16} className="mt-[3px] shrink-0" />
          <span>{success}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

const describe = (id, error, success, hint) => (error || success || hint ? `${id}-msg` : undefined);

/* ------------------------------------------------------------------ input */
export const Input = forwardRef(function Input(
  { label, hint, error, success, icon, endSlot, containerClassName = "", className = "", id: idProp, required, ...props },
  ref
) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field id={id} label={label} hint={hint} error={error} success={success} required={required} className={containerClassName}>
      {/* wrapper follows the input's own direction so LTR fields (email, phone) keep icon + padding on the same side */}
      <div className="relative" dir={props.dir}>
        {icon && (
          <span className="absolute inset-y-0 start-3 flex items-center text-ink-3 pointer-events-none">
            <Icon icon={icon} size={16} />
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe(id, error, success, hint)}
          data-valid={success ? true : undefined}
          className={`input ${icon ? "ps-10" : ""} ${endSlot ? "pe-12" : ""} ${className}`}
          {...props}
        />
        {endSlot && <div className="absolute inset-y-0 end-1 flex items-center">{endSlot}</div>}
      </div>
    </Field>
  );
});

export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Input
      ref={ref}
      dir="ltr"
      {...props}
      type={show ? "text" : "password"}
      endSlot={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={show}
          className="btn btn-ghost btn-icon btn-sm"
        >
          <Icon icon={show ? EyeOff : Eye} size={16} />
        </button>
      }
    />
  );
});

export function SearchInput({ value, onChange, placeholder = "بحث...", className = "", "aria-label": aria, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute inset-y-0 start-3 flex items-center text-ink-3 pointer-events-none">
        <Icon icon={Search} size={16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={aria || placeholder}
        className="input ps-10 pe-11 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="مسح البحث" className="btn btn-ghost btn-icon btn-sm absolute end-1 top-1/2 -translate-y-1/2">
          <Icon icon={X} size={16} />
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- select */
export const Select = forwardRef(function Select(
  { label, hint, error, success, containerClassName = "", className = "", id: idProp, required, children, ...props },
  ref
) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field id={id} label={label} hint={hint} error={error} success={success} required={required} className={containerClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe(id, error, success, hint)}
          className={`input ${className}`}
          {...props}
        >
          {children}
        </select>
        <span className="absolute inset-y-0 end-3 flex items-center text-ink-3 pointer-events-none">
          <Icon icon={ChevronDown} size={16} />
        </span>
      </div>
    </Field>
  );
});

/* --------------------------------------------------------------- textarea */
export const Textarea = forwardRef(function Textarea(
  { label, hint, error, success, containerClassName = "", className = "", id: idProp, required, ...props },
  ref
) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field id={id} label={label} hint={hint} error={error} success={success} required={required} className={containerClassName}>
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error, success, hint)}
        className={`input ${className}`}
        {...props}
      />
    </Field>
  );
});

/* ------------------------------------------------- checkbox / radio / switch */
export function Checkbox({ label, description, className = "", ...props }) {
  return (
    <label className={`flex items-start gap-3 min-h-[44px] py-2.5 cursor-pointer ${className}`}>
      <input type="checkbox" className="check mt-px" {...props} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3 mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

export function Radio({ label, description, className = "", ...props }) {
  return (
    <label className={`flex items-start gap-3 min-h-[44px] py-2.5 cursor-pointer ${className}`}>
      <input type="radio" className="radio mt-px" {...props} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3 mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, description, disabled, className = "" }) {
  const id = useId();
  return (
    <div className={`flex items-center justify-between gap-4 min-h-[44px] py-1 ${className}`}>
      <div className="min-w-0">
        <span id={`${id}-l`} className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3 mt-0.5">{description}</span>}
      </div>
      <button type="button" role="switch" aria-checked={!!checked} aria-labelledby={`${id}-l`} disabled={disabled} onClick={() => onChange(!checked)} className="switch" />
    </div>
  );
}

/** A group of big tappable choices (replaces a bare <select> when there are 2–4 options). */
export function ChoiceGroup({ label, value, onChange, options, name, columns = 3, className = "" }) {
  const auto = useId();
  const group = name || auto;
  const cols = columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
  return (
    <fieldset className={className}>
      {label && <legend className="label">{label}</legend>}
      <div className={`grid gap-2 ${cols}`} role="radiogroup">
        {options.map((o) => (
          <label key={o.value} className="block cursor-pointer">
            <input type="radio" name={group} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only peer" />
            <span className="flex items-center gap-3 min-h-[52px] px-3.5 py-2 rounded border border-line-field bg-raised text-sm transition-colors peer-checked:border-primary-ink peer-checked:bg-primary-soft peer-checked:text-primary-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)] hover:bg-sunken">
              {o.icon && <Icon icon={o.icon} size={20} className="shrink-0" />}
              <span className="min-w-0">
                <span className="block font-semibold">{o.label}</span>
                {o.description && <span className="block text-xs text-ink-3 font-normal">{o.description}</span>}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* --------------------------------------------------------------- file drop */
function matchesAccept(file, accept) {
  if (!accept) return true;
  return accept.split(",").map((s) => s.trim().toLowerCase()).some((rule) => {
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    return file.type.toLowerCase() === rule;
  });
}

/**
 * Drag-and-drop file picker with upload progress.
 * `progress` (0–100 or null) is driven by the caller's axios onUploadProgress.
 */
export function FileDrop({ label, hint, accept, file, onFile, progress = null, error, required, disabled, kind = "file", className = "" }) {
  const id = useId();
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [rejected, setRejected] = useState("");
  const uploading = progress !== null && progress !== undefined;

  function take(f) {
    if (!f) return;
    if (!matchesAccept(f, accept)) {
      setRejected(kind === "video" ? "الملف ده مش فيديو. اختار ملف بصيغة MP4 أو أي صيغة فيديو." : kind === "pdf" ? "الملف لازم يكون PDF." : "نوع الملف غير مدعوم.");
      return;
    }
    setRejected("");
    onFile(f);
  }
  const err = error || rejected;

  return (
    <div className={className}>
      {label && (
        <span id={`${id}-l`} className="label">
          {label}
          {required && <span className="text-bad ms-1" aria-hidden="true">*</span>}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }}
      />
      {file ? (
        <div className="dropzone" data-filled="true" style={{ alignItems: "stretch" }}>
          <div className="flex items-center gap-3">
            <span className={`ct ct-sm ${kind === "video" ? "ct-video" : "ct-file"}`}>
              <Icon icon={kind === "video" ? Film : FileIcon} size={16} />
            </span>
            <div className="min-w-0 flex-1 text-start">
              <p className="text-sm font-semibold text-ink truncate" dir="auto">{file.name}</p>
              <p className="text-xs text-ink-3 num">{fmtSize(file.size)}</p>
            </div>
            {!uploading && (
              <button type="button" onClick={() => onFile(null)} disabled={disabled} aria-label="إزالة الملف" className="btn btn-ghost btn-icon btn-sm">
                <Icon icon={X} size={16} />
              </button>
            )}
          </div>
          {uploading && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-sunken overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="تقدّم الرفع">
                <div className="h-full bg-primary rounded-full transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-ink-3 num">{progress < 100 ? `جارِ الرفع… ${progress}%` : "تم الرفع، جارِ الحفظ…"}</p>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={label ? `${id}-l` : undefined}
          aria-invalid={err ? true : undefined}
          className="dropzone"
          data-drag={drag || undefined}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) take(e.dataTransfer.files?.[0]); }}
        >
          <span className="ct ct-primary ct-sm mb-1"><Icon icon={UploadCloud} size={20} /></span>
          <p className="text-sm font-semibold text-ink">اسحب الملف هنا أو <span className="text-primary-ink underline underline-offset-4">اختاره من جهازك</span></p>
          {hint && <p className="text-xs text-ink-3">{hint}</p>}
        </div>
      )}
      {err && (
        <p className="field-error" role="alert">
          <Icon icon={AlertCircle} size={16} className="mt-[3px] shrink-0" />
          <span>{err}</span>
        </p>
      )}
    </div>
  );
}
