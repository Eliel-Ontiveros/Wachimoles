const assert = require("node:assert/strict");
const { test } = require("node:test");
const { decode } = require("../src/decoders/yoda1");
const { getDecoder } = require("../src/decoders");

const fromHex = (hex) => ({ manufacturerData: Buffer.from(hex, "hex") });

// Payloads reales capturados el 2026-11-14.
test("decodes 6.9 kg (la pantalla de la báscula marcó 6.9)", () => {
  assert.deepEqual(decode(fromHex("c00302b21388000025000000000000")), { weightKg: 6.9, sequence: 3 });
});

test("decodes the other captured weighing (0.80 kg)", () => {
  assert.deepEqual(decode(fromHex("c00100501388000025000000000000")), { weightKg: 0.8, sequence: 1 });
});

test("the idle packet decodes to weight 0, whatever byte 1 is", () => {
  assert.deepEqual(decode(fromHex("c00300000000000024000000000000")), { weightKg: 0, sequence: 3 });
  assert.deepEqual(decode(fromHex("c00100000000000024000000000000")), { weightKg: 0, sequence: 1 });
});

test("decodes consecutive real weighings with an increasing counter", () => {
  const weighings = [
    ["c0051eb91388000025000000000000", 78.65, 5],
    ["c0061eb91388000025000000000000", 78.65, 6],
    ["c0071f041388000025000000000000", 79.4, 7]
  ];
  for (const [hex, weightKg, sequence] of weighings) {
    assert.deepEqual(decode(fromHex(hex)), { weightKg, sequence });
  }
});

test("ignores packets that are not from this scale", () => {
  assert.equal(decode({}), null);
  assert.equal(decode(fromHex("4c0010063b1dee6c9828")), null); // Apple
  assert.equal(decode(fromHex("c00302b2")), null); // demasiado corto
  assert.equal(decode(fromHex("750042040101672015de2ab02d2215")), null);
});

test("is registered as the yoda1 decoder", () => {
  assert.equal(getDecoder("yoda1"), decode);
  assert.throws(() => getDecoder("nope"), /Disponibles: yoda1/);
});
