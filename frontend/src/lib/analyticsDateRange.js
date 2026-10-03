export const MAX_ANALYTICS_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value) {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / DAY_MS);
}

export function formatUtcDateInput(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftUtcDateInput(value, days) {
  const ordinal = parseDateOnly(value);
  return ordinal === null ? "" : formatUtcDateInput(new Date((ordinal + days) * DAY_MS));
}

export function getDefaultAnalyticsDateRange(now = new Date()) {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    from: formatUtcDateInput(new Date(todayStart - 29 * DAY_MS)),
    to: formatUtcDateInput(new Date(todayStart)),
  };
}

export function getAnalyticsDateRangeError(from, to, today = formatUtcDateInput(new Date())) {
  const fromDay = parseDateOnly(from);
  const toDay = parseDateOnly(to);
  const todayDay = parseDateOnly(today);
  if (fromDay === null || toDay === null || todayDay === null) return "اختر تاريخ بداية ونهاية صالحين.";
  if (fromDay > toDay) return "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.";
  if (toDay > todayDay) return "لا يمكن اختيار تاريخ مستقبلي.";
  if (toDay - fromDay + 1 > MAX_ANALYTICS_RANGE_DAYS) return `الحد الأقصى لنطاق التحليلات ${MAX_ANALYTICS_RANGE_DAYS} يومًا.`;
  return null;
}
