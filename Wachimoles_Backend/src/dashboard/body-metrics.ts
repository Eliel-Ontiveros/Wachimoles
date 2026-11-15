// Indicadores corporales derivados del peso medido por la báscula y del perfil
// del usuario. Todo es una función pura y se calcula al leer, no se guarda:
// así una fórmula mejorada corrige también los pesajes anteriores.
//
// "exact" son cuentas directas (peso + estatura). "estimated" son fórmulas de
// población (peso + estatura + edad + sexo): NO son mediciones. La báscula solo
// entrega el peso; no emite impedancia, así que grasa, agua y similares no se
// pueden medir con ella. No son valores médicos.

export type BodySex = "male" | "female";

/**
 * Solo la estatura es obligatoria. Con ella se calculan IMC y rangos de peso.
 * El peso ideal necesita además el sexo; las estimaciones de composición
 * corporal necesitan edad y sexo. Sin esos datos no se calculan (no se suponen).
 */
export interface BodyProfile {
  heightCm: number;
  ageYears: number | null;
  sex: BodySex | null;
}

export type BmiCategory = "underweight" | "healthy" | "overweight" | "obese";

export interface ExactBodyMetrics {
  /** Peso / estatura². */
  bmi: number;
  bmiCategory: BmiCategory;
  /** Peso para IMC 18.5, 24.9 y 29.9 (los cortes que muestra la app OKOK). */
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  overweightMaxKg: number;
  /** Hombres: (estatura cm - 80) * 0.7. Mujeres: (estatura cm - 70) * 0.6. null sin sexo. */
  idealWeightKg: number | null;
  /** Peso medido menos peso ideal; negativo si está por debajo. null sin sexo. */
  weightToIdealKg: number | null;
}

export interface EstimatedBodyMetrics {
  /** Deurenberg (1991), adultos. */
  bodyFatPercent: number;
  fatMassKg: number;
  leanMassKg: number;
  /** Watson (1980), agua corporal total en litros (1 L ≈ 1 kg). */
  bodyWaterLiters: number;
  bodyWaterPercent: number;
  /** Mifflin-St Jeor, metabolismo basal. */
  basalMetabolismKcal: number;
}

export interface BodyMetrics {
  exact: ExactBodyMetrics;
  /** null mientras falten edad o sexo en el perfil. */
  estimated: EstimatedBodyMetrics | null;
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function calculateBodyMetrics(
  weightKg: number,
  profile: BodyProfile
): BodyMetrics {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isFinite(profile.heightCm) ||
    profile.heightCm <= 0 ||
    (profile.ageYears !== null &&
      (!Number.isFinite(profile.ageYears) || profile.ageYears <= 0))
  ) {
    throw new RangeError("Weight, height and age must be positive numbers.");
  }

  const heightM = profile.heightCm / 100;
  const heightSquared = heightM * heightM;
  const bmi = weightKg / heightSquared;

  const bmiCategory: BmiCategory =
    bmi < 18.5
      ? "underweight"
      : bmi < 25
        ? "healthy"
        : bmi < 30
          ? "overweight"
          : "obese";

  const idealWeightKg =
    profile.sex === null
      ? null
      : profile.sex === "male"
        ? (profile.heightCm - 80) * 0.7
        : (profile.heightCm - 70) * 0.6;

  return {
    exact: {
      bmi: round(bmi, 2),
      bmiCategory,
      healthyWeightMinKg: round(18.5 * heightSquared, 2),
      healthyWeightMaxKg: round(24.9 * heightSquared, 2),
      overweightMaxKg: round(29.9 * heightSquared, 2),
      idealWeightKg: idealWeightKg === null ? null : round(idealWeightKg, 1),
      weightToIdealKg:
        idealWeightKg === null ? null : round(weightKg - idealWeightKg, 2)
    },
    estimated:
      profile.sex === null || profile.ageYears === null
        ? null
        : estimateComposition(weightKg, bmi, {
            heightCm: profile.heightCm,
            ageYears: profile.ageYears,
            sex: profile.sex
          })
  };
}

function estimateComposition(
  weightKg: number,
  bmi: number,
  profile: { heightCm: number; ageYears: number; sex: BodySex }
): EstimatedBodyMetrics {
  const isMale = profile.sex === "male";

  const bodyFatPercent = Math.min(
    60,
    Math.max(
      3,
      1.2 * bmi + 0.23 * profile.ageYears - 10.8 * (isMale ? 1 : 0) - 5.4
    )
  );
  const fatMassKg = (weightKg * bodyFatPercent) / 100;

  const bodyWaterLiters = isMale
    ? 2.447 -
      0.09156 * profile.ageYears +
      0.1074 * profile.heightCm +
      0.3362 * weightKg
    : -2.097 + 0.1069 * profile.heightCm + 0.2466 * weightKg;

  const basalMetabolismKcal =
    10 * weightKg +
    6.25 * profile.heightCm -
    5 * profile.ageYears +
    (isMale ? 5 : -161);

  return {
    bodyFatPercent: round(bodyFatPercent, 1),
    fatMassKg: round(fatMassKg, 1),
    leanMassKg: round(weightKg - fatMassKg, 1),
    bodyWaterLiters: round(bodyWaterLiters, 1),
    bodyWaterPercent: round((bodyWaterLiters / weightKg) * 100, 1),
    basalMetabolismKcal: round(basalMetabolismKcal, 1)
  };
}
