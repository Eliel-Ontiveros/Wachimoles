import { sanitizeIntent } from "./voice-intent";

describe("sanitizeIntent", () => {
  it("accepts known intents and rebuilds labels server-side", () => {
    expect(sanitizeIntent({ type: "navigate", route: "/missions", label: "x" }))
      .toEqual({ type: "navigate", route: "/missions", label: "Misiones y Viaje" });
    expect(sanitizeIntent({ type: "body-zone", muscleId: "biceps_der" }))
      .toEqual({ type: "body-zone", muscleId: "biceps_der", muscleName: "Bíceps derecho" });
    expect(sanitizeIntent({ type: "start-checkin", extra: 1 })).toEqual({ type: "start-checkin" });
  });

  it("rejects invented ids, routes, types and non-objects", () => {
    expect(sanitizeIntent({ type: "body-zone", muscleId: "alien_arm" })).toBeNull();
    expect(sanitizeIntent({ type: "body-zone", muscleId: "__proto__" })).toBeNull();
    expect(sanitizeIntent({ type: "navigate", route: "/admin" })).toBeNull();
    expect(sanitizeIntent({ type: "delete-all" })).toBeNull();
    expect(sanitizeIntent({ type: "unknown", message: "?" })).toBeNull();
    expect(sanitizeIntent(null)).toBeNull();
    expect(sanitizeIntent("open-menu")).toBeNull();
  });
});
