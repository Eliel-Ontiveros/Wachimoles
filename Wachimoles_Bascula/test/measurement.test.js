const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildMeasurement } = require("../src/measurement");

test("builds a measurement with a deterministic id", () => {
  assert.deepEqual(buildMeasurement(72.4, 1794190000000), {
    measurementId: "weight-1794190000000",
    weightKg: 72.4,
    measuredAt: 1794190000000,
    device: "okok-scale"
  });
});

test("rounds floating point noise and rejects impossible weights", () => {
  assert.equal(buildMeasurement(72.39999999, 1794190000000).weightKg, 72.4);
  assert.throws(() => buildMeasurement(0, 1794190000000));
  assert.throws(() => buildMeasurement(900, 1794190000000));
  assert.throws(() => buildMeasurement(NaN, 1794190000000));
});
