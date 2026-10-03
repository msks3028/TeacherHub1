/**
 * One place for every date / number the app shows, so the whole platform
 * agrees. Dates keep the Arabic (ar-EG) month & day names; digits are Latin
 * everywhere (tables, timers, scores, counters) for consistency and legibility.
 * To switch the whole app to Arabic-Indic digits, change LOCALE to "ar-EG".
 */
export const LOCALE = "ar-EG-u-nu-latn";

const nf = new Intl.NumberFormat(LOCALE);
const dDate = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });
const dShort = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const dTime = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const dLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });

const valid = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
};

export const fmtNumber = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? "-" : nf.format(Number(n)));
export const fmtDate = (d) => { const x = valid(d); return x ? dDate.format(x) : "-"; };
export const fmtDateShort = (d) => { const x = valid(d); return x ? dShort.format(x) : "-"; };
export const fmtTime = (d) => { const x = valid(d); return x ? dTime.format(x) : "-"; };
export const fmtDateTime = (d) => { const x = valid(d); return x ? `${dDate.format(x)}، ${dTime.format(x)}` : "-"; };
export const fmtDayLong = (d = new Date()) => dLong.format(valid(d) || new Date());

/** Arabic plural: 1 / 2 / 3–10 / 11+ */
export function plural(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${nf.format(n)} ${few}`;
  return `${nf.format(n)} ${many}`;
}

export const timeUnits = {
  day: (n) => plural(n, "يوم", "يومين", "أيام", "يومًا"),
  hour: (n) => plural(n, "ساعة", "ساعتين", "ساعات", "ساعة"),
  minute: (n) => plural(n, "دقيقة", "دقيقتين", "دقائق", "دقيقة"),
};

/**
 * Deadline urgency. `level` drives the colour: calm → soon → warn → urgent → late.
 */
export function deadlineInfo(deadline, now = new Date()) {
  const d = valid(deadline);
  if (!d) return { label: "بدون موعد نهائي", level: "none", late: false };
  const ms = d.getTime() - now.getTime();
  if (ms < 0) return { label: "انتهى الموعد", level: "late", late: true };
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return { label: `باقي ${timeUnits.day(days)}`, level: days > 3 ? "calm" : days > 1 ? "soon" : "warn", late: false };
  if (hours >= 1) return { label: `باقي ${timeUnits.hour(hours)}`, level: hours >= 6 ? "warn" : "urgent", late: false };
  return { label: `باقي ${timeUnits.minute(Math.max(mins, 1))}`, level: "urgent", late: false };
}

export const LEVEL_BADGE = {
  none: "badge",
  calm: "badge",
  soon: "badge badge-info",
  warn: "badge badge-warn",
  urgent: "badge badge-bad",
  late: "badge badge-bad",
};

export const firstName = (full = "") => full.trim().split(/\s+/)[0] || "";
export const percent = (score, max) => (max > 0 ? Math.round((score / max) * 100) : 0);

export function fmtSize(bytes) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${nf.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${nf.format(Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
