// The single place that decides "did this attempt pass?".
//
// `passed` used to be a value stored when the attempt was graded and each
// screen interpreted it on its own — so the student's screen and the teacher's
// screen could disagree (e.g. an exam with NO passing score has passed = null,
// which one screen showed as "passed" and the other as "failed"). Every
// endpoint now derives it from the same two facts: the attempt's score and the
// exam's passing score.

const EPSILON = 1e-9;

// true / false — or null when there is nothing to decide (no passing score was
// set for the exam, or the attempt has no final score yet).
function evaluatePassed(score, passingScore) {
  if (score === null || score === undefined || passingScore === null || passingScore === undefined) return null;
  return score + EPSILON >= passingScore;
}

// Returns a copy of `attempt` whose `passed` is derived from the exam's rules.
// Only fully graded attempts have a verdict.
function withPassed(attempt, exam) {
  return { ...attempt, passed: attempt.status === "GRADED" ? evaluatePassed(attempt.score, exam.passingScore) : null };
}

const hasText = (v) => typeof v === "string" && v.trim() !== "";

module.exports = { evaluatePassed, withPassed, hasText };
