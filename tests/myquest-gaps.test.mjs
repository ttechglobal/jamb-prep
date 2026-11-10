import test from "node:test";
import assert from "node:assert/strict";
import { yearRows } from "../lib/myquest/gaps.ts";

test("years are newest first and classified as held, staged or gap", () => {
  const rows = yearRows(["2023", "2025", "2024", "2022"], new Map([[2025, 38], [2023, 10]]), new Map([["2024", { status: "complete", fetched: 40 }]]));
  assert.deepEqual(rows.map((r) => [r.year, r.state, r.inBank]), [
    ["2025", "held", 38],
    ["2024", "staged", 0],
    ["2023", "held", 10],
    ["2022", "gap", 0],
  ]);
});

test("a year that is both in the bank and staged counts as held", () => {
  const [row] = yearRows(["2025"], new Map([[2025, 38]]), new Map([["2025", { status: "complete", fetched: 40 }]]));
  assert.equal(row.state, "held");
  assert.equal(row.staged.fetched, 40);
});

test("a non-numeric year id is never treated as held", () => {
  const [row] = yearRows(["2025-B"], new Map([[2025, 38]]), new Map());
  assert.equal(row.state, "gap");
});

test("no years gives no rows", () => {
  assert.deepEqual(yearRows([], new Map(), new Map()), []);
});
