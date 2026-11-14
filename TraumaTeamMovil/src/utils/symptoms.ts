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
