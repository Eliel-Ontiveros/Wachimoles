import type { BodyRegionCategory } from '../types/dashboard.ts';

/**
 * Symptom labels are stored as data. New data is English; legacy Spanish values
 * already persisted in the backend are still recognised and shown in English.
 */
const LEGACY_SYMPTOM_LABELS: Record<string, string> = {
  ninguno: 'None',
  'mareo 0g': 'Zero-G dizziness',
  congestion: 'Congestion',
  fatiga: 'Fatigue',
  cefalea: 'Headache',
};

function normalizeSymptomKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Returns the English display label for a stored symptom (legacy Spanish or English). */
export function displaySymptom(value: string): string {
  return LEGACY_SYMPTOM_LABELS[normalizeSymptomKey(value)] ?? value;
}

/** True when the stored symptom means "no symptoms" (English or legacy Spanish). */
export function isNoSymptom(value: string): boolean {
  return displaySymptom(value).trim().toLowerCase() === 'none';
}

/** English display names for the stored body-region enum values (values themselves never change). */
const REGION_CATEGORY_LABELS: Record<BodyRegionCategory, string> = {
  'Cabeza y cuello': 'Head and neck',
  'Tronco anterior': 'Anterior torso',
  'Tronco posterior': 'Posterior torso',
  'Extremidad superior': 'Upper limb',
  'Cadera y pelvis': 'Hip and pelvis',
  'Extremidad inferior': 'Lower limb',
};

export function getRegionCategoryLabel(category: string): string {
  return REGION_CATEGORY_LABELS[category as BodyRegionCategory] ?? category;
}

/** Legacy Spanish gravity labels stored by older backends are shown in English. */
export function getGravityLabel(label: string): string {
  return label.replace(/Microgravedad/gi, 'Microgravity');
}
