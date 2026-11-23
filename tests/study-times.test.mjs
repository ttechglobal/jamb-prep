// Study time helpers. Run: node --test tests/study-times.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { ALL_DAYS, WEEKDAYS, daysLabel, presetOf, problemWith, timeLabel } from "../lib/study/days.ts";

test("days are named the way a student would say them", () => {
  assert.equal(presetOf(ALL_DAYS), "every");
  assert.equal(presetOf([7, 6, 5, 4, 3, 2, 1]), "every");
  assert.equal(presetOf(WEEKDAYS), "weekdays");
  assert.equal(presetOf([1, 2, 3]), "custom");
  assert.equal(presetOf([1, 2, 3, 4, 5, 6]), "custom");
  assert.equal(daysLabel(ALL_DAYS), "Every day");
  assert.equal(daysLabel(WEEKDAYS), "Weekdays");
  assert.equal(daysLabel([5, 1, 3]), "Mon, Wed, Fri");
  assert.equal(daysLabel([6, 7]), "Sat, Sun");
});

test("times read as a clock", () => {
  assert.equal(timeLabel("18:30"), "6:30 pm");
  assert.equal(timeLabel("07:00"), "7:00 am");
  assert.equal(timeLabel("00:05"), "12:05 am");
  assert.equal(timeLabel("12:00"), "12:00 pm");
});

test("a list of study times is checked before it is saved", () => {
  assert.equal(problemWith([]), null);
  assert.equal(problemWith([{ time: "18:30", days: WEEKDAYS }, { time: "07:00", days: [7] }]), null);
  assert.match(problemWith([{ time: "", days: [1] }]), /Choose a time/);
  assert.match(problemWith([{ time: "07:00", days: [] }]), /at least one day/);
  assert.match(problemWith([{ time: "07:00", days: [1] }, { time: "07:00", days: [2] }]), /same time/);
  assert.match(problemWith([1, 2, 3, 4].map((h) => ({ time: `0${h}:00`, days: [1] }))), /up to 3/);
});