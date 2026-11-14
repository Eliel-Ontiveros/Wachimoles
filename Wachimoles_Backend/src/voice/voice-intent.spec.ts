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

  describe("action intents", () => {
    it("accepts every new intent type", () => {
      expect(sanitizeIntent({ type: "register-observation", muscleId: "deltoides_izq", painIntensity: 5, swelling: true, functionalLimitation: false, notes: " hola ", junk: 1 }))
        .toEqual({ type: "register-observation", muscleId: "deltoides_izq", painIntensity: 5, swelling: true, functionalLimitation: false, notes: "hola" });
      expect(sanitizeIntent({ type: "zone-detail", muscleId: "biceps_der" })).toEqual({ type: "zone-detail", muscleId: "biceps_der" });
      expect(sanitizeIntent({ type: "zone-photos", muscleId: "pie_izq" })).toEqual({ type: "zone-photos", muscleId: "pie_izq" });
      expect(sanitizeIntent({ type: "set-environment", environment: "marte" })).toEqual({ type: "set-environment", environment: "marte" });
      expect(sanitizeIntent({ type: "open-mission-setup", x: 1 })).toEqual({ type: "open-mission-setup" });
      expect(sanitizeIntent({ type: "arrive-early" })).toEqual({ type: "arrive-early" });
      expect(sanitizeIntent({ type: "dismiss-alert" })).toEqual({ type: "dismiss-alert" });
      expect(sanitizeIntent({ type: "complete-mission", missionId: "env-luna-eva" })).toEqual({ type: "complete-mission", missionId: "env-luna-eva" });
      expect(sanitizeIntent({ type: "vital-history", metric: "spo2" })).toEqual({ type: "vital-history", metric: "spo2" });
      expect(sanitizeIntent({ type: "fill-health-check", bloodSugarMgDl: 110, systolicBp: 120, diastolicBp: 80, temperatureC: 36.5, sleepHours: 7, mood: 4, symptoms: ["Fatiga"], notes: "ok", z: 1 }))
        .toEqual({ type: "fill-health-check", bloodSugarMgDl: 110, systolicBp: 120, diastolicBp: 80, temperatureC: 36.5, sleepHours: 7, mood: 4, symptoms: ["Fatiga"], notes: "ok" });
    });

    it("rejects invalid required fields", () => {
      expect(sanitizeIntent({ type: "register-observation", muscleId: "alien" })).toBeNull();
      expect(sanitizeIntent({ type: "zone-detail", muscleId: "__proto__" })).toBeNull();
      expect(sanitizeIntent({ type: "zone-photos" })).toBeNull();
      expect(sanitizeIntent({ type: "set-environment", environment: "venus" })).toBeNull();
      expect(sanitizeIntent({ type: "set-environment", environment: "constructor" })).toBeNull();
      expect(sanitizeIntent({ type: "complete-mission", missionId: "nope" })).toBeNull();
      expect(sanitizeIntent({ type: "complete-mission", missionId: "toString" })).toBeNull();
      expect(sanitizeIntent({ type: "vital-history", metric: "bp" })).toBeNull();
    });

    it("omits invalid optional fields but keeps the intent", () => {
      const base = { type: "register-observation", muscleId: "cuello" };
      expect(sanitizeIntent({ ...base, painIntensity: 11 })).toEqual({ ...base });
      expect(sanitizeIntent({ ...base, painIntensity: 0 })).toEqual({ ...base });
      expect(sanitizeIntent({ ...base, painIntensity: 2.5 })).toEqual({ ...base });
      expect(sanitizeIntent({ ...base, painIntensity: "5" })).toEqual({ ...base });
      expect(sanitizeIntent({ ...base, swelling: "yes" })).toEqual({ ...base });
      expect(sanitizeIntent({ ...base, notes: "a".repeat(500) })).toEqual({ ...base, notes: "a".repeat(300) });
    });

    it("fill-health-check filters, bounds and rejects empty", () => {
      expect(sanitizeIntent({ type: "fill-health-check", sleepHours: 7, mood: 9, bloodSugarMgDl: 5, systolicBp: "120", symptoms: ["Fatiga", "Rabia"] }))
        .toEqual({ type: "fill-health-check", sleepHours: 7, symptoms: ["Fatiga"] });
      expect(sanitizeIntent({ type: "fill-health-check", symptoms: ["Rabia"], mood: 0, temperatureC: Infinity, notes: "  " })).toBeNull();
      expect(sanitizeIntent({ type: "fill-health-check" })).toBeNull();
    });
  });
});
