const { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT } = require("../src/utils/pagination");

describe("parsePagination", () => {
  test("defaults to page 1 and the default limit when nothing is given", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  test("computes skip from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  test("rejects a zero or negative page and falls back to 1", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
  });

  test("rejects non-numeric input", () => {
    expect(parsePagination({ page: "abc", limit: "xyz" })).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  test("caps limit at MAX_LIMIT so nobody can request the whole table at once", () => {
    expect(parsePagination({ limit: "999999" }).limit).toBe(MAX_LIMIT);
  });
});

describe("buildMeta", () => {
  test("reports correct totalPages, rounding up", () => {
    expect(buildMeta(1, 20, 45).totalPages).toBe(3);
  });

  test("hasNextPage / hasPrevPage reflect position within the result set", () => {
    expect(buildMeta(1, 20, 45)).toMatchObject({ hasPrevPage: false, hasNextPage: true });
    expect(buildMeta(3, 20, 45)).toMatchObject({ hasPrevPage: true, hasNextPage: false });
  });

  test("an empty result set still reports at least 1 total page", () => {
    expect(buildMeta(1, 20, 0).totalPages).toBe(1);
  });
});
