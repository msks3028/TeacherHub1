const { parseAnalyticsDateRange } = require("../src/utils/analyticsDateRange");

describe("teacher analytics date range", () => {
  const now = new Date("2024-02-29T12:00:00.000Z");

  test("uses a valid 30-day default when both dates are omitted", () => {
    const result = parseAnalyticsDateRange({}, now);

    expect(result.valid).toBe(true);
    expect(result.from.toISOString()).toBe("2024-01-31T12:00:00.000Z");
    expect(result.to).toEqual(now);
  });

  test("accepts the current date through the end of that date", () => {
    const result = parseAnalyticsDateRange({ from: "2024-02-01", to: "2024-02-29" }, now);

    expect(result.valid).toBe(true);
    expect(result.to.toISOString()).toBe("2024-02-29T23:59:59.999Z");
  });

  test("rejects a future date-only end date", () => {
    expect(parseAnalyticsDateRange({ from: "2024-02-01", to: "2024-03-01" }, now)).toEqual({ valid: false, reason: "future" });
  });

  test("keeps the inclusive limit at 366 calendar days across a leap year", () => {
    const afterLeapYear = new Date("2025-01-02T12:00:00.000Z");
    expect(parseAnalyticsDateRange({ from: "2024-01-01", to: "2024-12-31" }, afterLeapYear).valid).toBe(true);
    expect(parseAnalyticsDateRange({ from: "2024-01-01", to: "2025-01-01" }, afterLeapYear).reason).toBe("range");
  });

  test("rejects an overlong range when its end date is not in the future", () => {
    const afterRange = new Date("2025-01-02T12:00:00.000Z");
    expect(parseAnalyticsDateRange({ from: "2024-01-01", to: "2025-01-01" }, afterRange)).toEqual({ valid: false, reason: "range" });
  });

  test("rejects an invalid leap-day and a reversed range", () => {
    expect(parseAnalyticsDateRange({ from: "2023-02-29", to: "2023-03-01" }, now).reason).toBe("invalid");
    expect(parseAnalyticsDateRange({ from: "2024-03-01", to: "2024-02-29" }, now).reason).toBe("order");
  });
});
