const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createWeighingFilter } = require("../src/weighing-filter");

const r = (weightKg) => ({ weightKg });

test("waits for consecutive identical readings and ignores zero", () => {
  const filter = createWeighingFilter({ repeats: 3, minSecondsBetween: 0 });
  assert.equal(filter.accept(r(0), 0), null);
  assert.equal(filter.accept(r(68.1), 100), null);
  assert.equal(filter.accept(r(68.4), 200), null); // valor cambió: reinicia
  assert.equal(filter.accept(r(68.4), 300), null);
  assert.deepEqual(filter.accept(r(68.4), 400), { weightKg: 68.4, measuredAt: 400 });
});

test("sends a weighing once, then re-arms when the scale returns to zero", () => {
  const filter = createWeighingFilter({ repeats: 2, minSecondsBetween: 0 });
  filter.accept(r(70), 0);
  assert.notEqual(filter.accept(r(70), 100), null);
  assert.equal(filter.accept(r(70), 200), null);
  assert.equal(filter.accept(r(70), 300), null);
  filter.accept(r(0), 400); // te bajas
  filter.accept(r(70), 500);
  assert.notEqual(filter.accept(r(70), 600), null); // mismo peso, nuevo pesaje
});

test("never uploads twice within minSecondsBetween", () => {
  const filter = createWeighingFilter({ repeats: 1, minSecondsBetween: 10 });
  assert.notEqual(filter.accept(r(70), 0), null);
  filter.accept(r(0), 1000);
  assert.equal(filter.accept(r(71), 2000), null);
  assert.notEqual(filter.accept(r(71), 11000), null);
});

test("two back-to-back weighings with the same weight are both sent", () => {
  const filter = createWeighingFilter({ repeats: 2, minSecondsBetween: 0 });
  const at = (sequence) => ({ weightKg: 78.65, sequence });
  filter.accept(at(5), 0);
  assert.notEqual(filter.accept(at(5), 100), null);
  assert.equal(filter.accept(at(5), 200), null);
  // El anuncio en cero se perdió, pero el contador cambió: es otro pesaje.
  filter.accept(at(6), 300);
  assert.notEqual(filter.accept(at(6), 400), null);
});
