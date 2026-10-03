const { evaluatePassed, withPassed, hasText } = require("../src/services/examScoring");

describe("evaluatePassed", () => {
  test("returns true when the score meets the passing score exactly", () => {
    expect(evaluatePassed(50, 50)).toBe(true);
  });

  test("returns true when the score is above the passing score", () => {
    expect(evaluatePassed(75, 50)).toBe(true);
  });

  test("returns false when the score is below the passing score", () => {
    expect(evaluatePassed(49, 50)).toBe(false);
  });

  test("tolerates floating point rounding at the boundary (e.g. 49.999999999 vs 50)", () => {
    // 0.1 + 0.2 style float error should not flip a genuine pass into a fail.
    expect(evaluatePassed(49.99999999991, 50)).toBe(true);
  });

  test("returns null when the exam has no passing score configured", () => {
    expect(evaluatePassed(80, null)).toBeNull();
    expect(evaluatePassed(80, undefined)).toBeNull();
  });

  test("returns null when there is no score yet (attempt not graded)", () => {
    expect(evaluatePassed(null, 50)).toBeNull();
    expect(evaluatePassed(undefined, 50)).toBeNull();
  });

  test("returns null when neither score nor passing score exist", () => {
    expect(evaluatePassed(null, null)).toBeNull();
  });

  test("a score of 0 against a passing score of 0 still passes (falsy value bug guard)", () => {
    // A naive `if (!score || !passingScore) return null` would wrongly treat
    // 0 as "missing" here — this guards against that regression.
    expect(evaluatePassed(0, 0)).toBe(true);
  });
});

describe("withPassed", () => {
  const exam = { passingScore: 60 };

  test("GRADED attempts get a real verdict derived from the exam's passing score", () => {
    const attempt = { id: "a1", status: "GRADED", score: 70 };
    expect(withPassed(attempt, exam).passed).toBe(true);
  });

  test("GRADED attempts below the passing score are marked failed, not null", () => {
    const attempt = { id: "a2", status: "GRADED", score: 40 };
    expect(withPassed(attempt, exam).passed).toBe(false);
  });

  test("attempts still awaiting grading (SUBMITTED) never show a verdict, even with a score", () => {
    // This is the exact bug the service exists to prevent: a partially
    // auto-scored attempt (multiple choice graded, essays pending) must not
    // show as pass/fail before the teacher finishes grading it.
    const attempt = { id: "a3", status: "SUBMITTED", score: 90 };
    expect(withPassed(attempt, exam).passed).toBeNull();
  });

  test("does not mutate the original attempt object", () => {
    const attempt = { id: "a4", status: "GRADED", score: 70 };
    const result = withPassed(attempt, exam);
    expect(result).not.toBe(attempt);
    expect(attempt.passed).toBeUndefined();
  });

  test("an exam with no passing score never marks anyone as passed or failed", () => {
    const openExam = { passingScore: null };
    const attempt = { id: "a5", status: "GRADED", score: 100 };
    expect(withPassed(attempt, openExam).passed).toBeNull();
  });
});

describe("hasText", () => {
  test("true for a non-empty string", () => {
    expect(hasText("hello")).toBe(true);
  });

  test("false for an empty or whitespace-only string", () => {
    expect(hasText("")).toBe(false);
    expect(hasText("   ")).toBe(false);
  });

  test("false for null, undefined, or non-string values", () => {
    expect(hasText(null)).toBe(false);
    expect(hasText(undefined)).toBe(false);
    expect(hasText(123)).toBe(false);
  });
});
