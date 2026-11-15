import { calculateBodyMetrics } from "./body-metrics";

// Datos de la app OKOK (reporte del 2026-05-26): 78.00 kg, 172 cm, 21 años.
const profile = { heightCm: 172, ageYears: 21, sex: "male" as const };

describe("calculateBodyMetrics", () => {
  it("reproduces the exact values the OKOK app shows", () => {
    const { exact } = calculateBodyMetrics(78, profile);

    expect(exact.bmi).toBeCloseTo(26.4, 1); // app: 26.4
    expect(exact.healthyWeightMinKg).toBe(54.73); // app: 54.73
    expect(exact.healthyWeightMaxKg).toBe(73.66); // app: 73.66
    expect(exact.overweightMaxKg).toBe(88.46); // app: 88.46
    expect(exact.idealWeightKg).toBe(64.4); // app: Ideal weight 64.40
    expect(exact.weightToIdealKg).toBe(13.6); // app: -13.60
    expect(exact.bmiCategory).toBe("overweight");
  });

  it("estimates composition with public formulas (not a measurement)", () => {
    const { estimated } = calculateBodyMetrics(78, profile);

    expect(estimated?.bodyFatPercent).toBe(20.3); // Deurenberg
    expect(estimated?.fatMassKg).toBeCloseTo(15.8, 1);
    expect(estimated?.leanMassKg).toBeCloseTo(62.2, 1);
    expect(estimated?.bodyWaterLiters).toBe(45.2); // Watson
    expect(estimated?.basalMetabolismKcal).toBe(1755); // Mifflin-St Jeor
  });

  it("scales with the measured weight", () => {
    const { exact } = calculateBodyMetrics(78.65, profile);
    expect(exact.bmi).toBeCloseTo(26.59, 2);
    expect(exact.weightToIdealKg).toBe(14.25);
  });

  it("uses the female variants of the formulas", () => {
    const { exact, estimated } = calculateBodyMetrics(60, {
      heightCm: 165,
      ageYears: 30,
      sex: "female"
    });
    expect(exact.idealWeightKg).toBe(57); // (165 - 70) * 0.6
    expect(estimated?.basalMetabolismKcal).toBe(1320.3); // 600 + 1031.25 - 150 - 161 = 1320.25
    expect(estimated?.bodyWaterLiters).toBeCloseTo(-2.097 + 0.1069 * 165 + 0.2466 * 60, 1);
  });

  it("with only the height it calculates what needs nothing else", () => {
    const metrics = calculateBodyMetrics(86, {
      heightCm: 177,
      ageYears: null,
      sex: null
    });

    expect(metrics.exact.bmi).toBeCloseTo(27.45, 2);
    expect(metrics.exact.bmiCategory).toBe("overweight");
    expect(metrics.exact.healthyWeightMinKg).toBe(57.96);
    expect(metrics.exact.healthyWeightMaxKg).toBe(78.01);
    expect(metrics.exact.overweightMaxKg).toBe(93.67);
    // Peso ideal y estimaciones necesitan datos que no se suponen.
    expect(metrics.exact.idealWeightKg).toBeNull();
    expect(metrics.exact.weightToIdealKg).toBeNull();
    expect(metrics.estimated).toBeNull();
  });

  it("with the sex but no age it adds the ideal weight but still no estimates", () => {
    const metrics = calculateBodyMetrics(86, {
      heightCm: 177,
      ageYears: null,
      sex: "male"
    });
    expect(metrics.exact.idealWeightKg).toBe(67.9); // (177 - 80) * 0.7
    expect(metrics.exact.weightToIdealKg).toBe(18.1);
    expect(metrics.estimated).toBeNull();
  });

  it("classifies BMI categories", () => {
    const category = (kg: number) =>
      calculateBodyMetrics(kg, profile).exact.bmiCategory;
    expect(category(50)).toBe("underweight");
    expect(category(65)).toBe("healthy");
    expect(category(78)).toBe("overweight");
    expect(category(95)).toBe("obese");
  });

  it("rejects invalid input", () => {
    expect(() => calculateBodyMetrics(0, profile)).toThrow(RangeError);
    expect(() =>
      calculateBodyMetrics(70, { ...profile, heightCm: 0 })
    ).toThrow(RangeError);
    expect(() => calculateBodyMetrics(NaN, profile)).toThrow(RangeError);
    expect(() =>
      calculateBodyMetrics(70, { ...profile, ageYears: 0 })
    ).toThrow(RangeError);
  });
});
