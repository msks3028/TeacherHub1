import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatUtcDateInput,
  getAnalyticsDateRangeError,
  getDefaultAnalyticsDateRange,
  shiftUtcDateInput,
} from "../src/lib/analyticsDateRange.js";

test("first-open defaults are 30 inclusive UTC calendar days", () => {
  const range = getDefaultAnalyticsDateRange(new Date("2024-03-01T00:30:00.000Z"));
  assert.deepEqual(range, { from: "2024-02-01", to: "2024-03-01" });
  assert.equal(getAnalyticsDateRangeError(range.from, range.to, "2024-03-01"), null);
});

test("a date input formats UTC calendar fields without timestamp conversion", () => {
  assert.equal(formatUtcDateInput(new Date("2024-02-29T23:59:59.999Z")), "2024-02-29");
});

test("permits 366 inclusive days, including leap year ranges, and rejects 367", () => {
  assert.equal(getAnalyticsDateRangeError("2024-01-01", "2024-12-31", "2025-01-01"), null);
  assert.match(getAnalyticsDateRangeError("2024-01-01", "2025-01-01", "2025-01-01"), /366/);
});

test("reports reversed, future, and malformed selections", () => {
  assert.match(getAnalyticsDateRangeError("2024-03-02", "2024-03-01", "2024-03-10"), /البداية/);
  assert.match(getAnalyticsDateRangeError("2024-03-01", "2024-03-11", "2024-03-10"), /مستقبلي/);
  assert.match(getAnalyticsDateRangeError("2024-02-30", "2024-03-01", "2024-03-10"), /صالحين/);
});

test("date input bounds keep the start within the 366-day window", () => {
  assert.equal(shiftUtcDateInput("2024-12-31", -365), "2024-01-01");
});

test("analytics page blocks API requests for invalid ranges and constrains date inputs", async () => {
  const page = await readFile(new URL("../src/pages/teacher/AnalyticsPage.jsx", import.meta.url), "utf8");
  assert.match(page, /useApi\(url, \{ enabled: !rangeError \}\)/);
  assert.match(page, /max=\{to \|\| today\}/);
  assert.match(page, /min=\{from\} max=\{today\}/);
});
