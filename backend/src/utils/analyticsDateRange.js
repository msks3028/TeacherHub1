const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_RANGE_DAYS = 366;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateValue(raw, { endOfDay = false } = {}) {
  const match = DATE_ONLY.exec(raw);
  if (match) {
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const start = new Date(0);
    start.setUTCFullYear(year, month - 1, day);
    start.setUTCHours(0, 0, 0, 0);
    if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null;
    const dayStart = start.getTime();
    return { date: new Date(dayStart + (endOfDay ? DAY_MS - 1 : 0)), dayStart, dateOnly: true };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { date, dayStart: null, dateOnly: false };
}

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseAnalyticsDateRange(query = {}, now = new Date()) {
  const hasTo = query.to !== undefined;
  const hasFrom = query.from !== undefined;
  if ((hasTo && typeof query.to !== "string") || (hasFrom && typeof query.from !== "string")) {
    return { valid: false, reason: "invalid" };
  }

  const to = hasTo ? parseDateValue(query.to, { endOfDay: true }) : { date: now, dayStart: startOfUtcDay(now), dateOnly: false };
  if (!to) return { valid: false, reason: "invalid" };

  const from = hasFrom
    ? parseDateValue(query.from)
    : { date: new Date((to.dateOnly ? to.dayStart : to.date.getTime()) - 29 * DAY_MS), dayStart: null, dateOnly: false };
  if (!from) return { valid: false, reason: "invalid" };
  if (from.date > to.date) return { valid: false, reason: "order" };

  // Date inputs send calendar dates, not instants. Permit the current UTC day
  // through its end; comparing its 23:59 boundary to the current instant
  // incorrectly made today's default date appear to be in the future.
  if (to.dateOnly ? to.dayStart > startOfUtcDay(now) : to.date > new Date(now.getTime() + 60_000)) {
    return { valid: false, reason: "future" };
  }

  if (from.dateOnly && to.dateOnly) {
    const inclusiveDays = Math.floor((to.dayStart - from.dayStart) / DAY_MS) + 1;
    if (inclusiveDays > MAX_ANALYTICS_RANGE_DAYS) return { valid: false, reason: "range" };
  } else if (to.date.getTime() - from.date.getTime() > MAX_ANALYTICS_RANGE_DAYS * DAY_MS) {
    return { valid: false, reason: "range" };
  }

  return { valid: true, from: from.date, to: to.date };
}

const ERROR_MESSAGES = {
  invalid: "صيغة التاريخ غير صالحة.",
  order: "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.",
  future: "لا يمكن اختيار تاريخ مستقبلي.",
  range: "الحد الأقصى لنطاق التحليلات 366 يومًا.",
};

module.exports = { parseAnalyticsDateRange, ERROR_MESSAGES };
