import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TEACHER_NAV, STUDENT_NAV } from "../src/components/layout/nav.js";

test("teacher navigation and route exclude AI while student AI stays available", async () => {
  assert.equal(TEACHER_NAV.some((item) => item.to === "/teacher/ai"), false);
  assert.equal(STUDENT_NAV.some((item) => item.to === "/student/ai"), true);

  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /path=["']\/teacher\/ai["']/);
  assert.match(app, /path=["']\/student\/ai["']/);
});
