import type { BodySex, ExactBodyMetrics } from '../types/dashboard';
import {
  computeBilateralPointerPct,
  type BilateralBand,
  type BilateralIndexRanges,
} from './gauge.ts';

/**
 * Reference bands for the smart-scale cards. Each metric is split by four
 * ascending cut-offs; a value equal to a cut-off belongs to the upper band.
 */
export interface BodyGauge {
  band: BilateralBand;
  pointerPct: number;
  legend: BilateralIndexRanges;
}

type Cutoffs = readonly [number, number, number, number];

const BANDS: readonly BilateralBand[] = [
  'low-critical',
  'low-warning',
  'normal',
  'high-warning',
  'high-critical',
];

function classify(value: number, cutoffs: Cutoffs, legend: BilateralIndexRanges): BodyGauge {
  const index = cutoffs.filter((cutoff) => value >= cutoff).length;
  const lower = index === 0 ? null : cutoffs[index - 1];
  const upper = index === cutoffs.length ? null : cutoffs[index];
  // Open-ended outer bands have no width; the pointer sits in their middle.
  const ratio = lower === null || upper === null ? 0.5 : (value - lower) / (upper - lower);
  const band = BANDS[index];
  return { band, pointerPct: computeBilateralPointerPct(band, ratio), legend };
}

/** WHO adult BMI categories; below 16 is severe thinness. */
const BMI_CUTOFFS: Cutoffs = [16, 18.5, 25, 30];
const BMI_LEGEND: BilateralIndexRanges = {
  lowCritical: '<16',
  lowWarning: '16–18.4',
  normal: '18.5–24.9',
  highWarning: '25–29.9',
  highCritical: '≥30',
};

export function bmiGauge(bmi: number): BodyGauge {
  return classify(bmi, BMI_CUTOFFS, BMI_LEGEND);
}

/** The same BMI bands expressed in kilograms for the profile's height. */
export function weightGauge(weightKg: number, exact: ExactBodyMetrics): BodyGauge {
  const severeThinKg = (exact.healthyWeightMinKg * BMI_CUTOFFS[0]) / BMI_CUTOFFS[1];
  const cutoffs: Cutoffs = [
    severeThinKg,
    exact.healthyWeightMinKg,
    exact.healthyWeightMaxKg,
    exact.overweightMaxKg,
  ];
  const kg = cutoffs.map((cutoff) => Math.round(cutoff));
  return classify(weightKg, cutoffs, {
    lowCritical: `<${kg[0]}`,
    lowWarning: `${kg[0]}–${kg[1]}`,
    normal: `${kg[1]}–${kg[2]}`,
    highWarning: `${kg[2]}–${kg[3]}`,
    highCritical: `>${kg[3]}`,
  });
}

/** ACSM body-fat references for adults (essential fat, healthy, high, obese). */
const BODY_FAT: Record<BodySex, { cutoffs: Cutoffs; legend: BilateralIndexRanges }> = {
  male: {
    cutoffs: [5, 8, 20, 25],
    legend: { lowCritical: '<5', lowWarning: '5–7', normal: '8–19', highWarning: '20–24', highCritical: '≥25' },
  },
  female: {
    cutoffs: [13, 21, 33, 39],
    legend: { lowCritical: '<13', lowWarning: '13–20', normal: '21–32', highWarning: '33–38', highCritical: '≥39' },
  },
};

export function bodyFatGauge(percent: number, sex: BodySex | null): BodyGauge | null {
  if (!sex) return null;
  return classify(percent, BODY_FAT[sex].cutoffs, BODY_FAT[sex].legend);
}

/** Usual adult total-body-water ranges as a share of body weight. */
const BODY_WATER: Record<BodySex, { cutoffs: Cutoffs; legend: BilateralIndexRanges }> = {
  male: {
    cutoffs: [45, 50, 65, 70],
    legend: { lowCritical: '<45', lowWarning: '45–49', normal: '50–65', highWarning: '65–70', highCritical: '>70' },
  },
  female: {
    cutoffs: [40, 45, 60, 65],
    legend: { lowCritical: '<40', lowWarning: '40–44', normal: '45–60', highWarning: '60–65', highCritical: '>65' },
  },
};

export function bodyWaterGauge(percent: number, sex: BodySex | null): BodyGauge | null {
  if (!sex) return null;
  return classify(percent, BODY_WATER[sex].cutoffs, BODY_WATER[sex].legend);
}
