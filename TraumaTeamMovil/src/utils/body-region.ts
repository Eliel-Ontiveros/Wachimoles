export type BodyRegionCategory =
  | 'Head and neck'
  | 'Front torso'
  | 'Back torso'
  | 'Upper limb'
  | 'Hip and pelvis'
  | 'Lower limb';

export type BackendBodyRegion =
  | 'Cabeza y cuello'
  | 'Tronco anterior'
  | 'Tronco posterior'
  | 'Extremidad superior'
  | 'Cadera y pelvis'
  | 'Extremidad inferior';

const BACKEND_BODY_REGIONS: Record<BodyRegionCategory, BackendBodyRegion> = {
  'Head and neck': 'Cabeza y cuello',
  'Front torso': 'Tronco anterior',
  'Back torso': 'Tronco posterior',
  'Upper limb': 'Extremidad superior',
  'Hip and pelvis': 'Cadera y pelvis',
  'Lower limb': 'Extremidad inferior',
};

const REGION_ALIASES: Record<string, BodyRegionCategory> = {
  ...Object.fromEntries(
    (Object.entries(BACKEND_BODY_REGIONS) as [BodyRegionCategory, BackendBodyRegion][]).flatMap(
      ([en, es]) => [
        [en.toLowerCase(), en],
        [es.toLowerCase(), en],
      ]
    )
  ),
  'anterior torso': 'Front torso',
  'posterior torso': 'Back torso',
};

/** Accepts an English UI region or a Spanish backend region; unknown values fall back to 'Front torso'. */
export function normalizeBodyRegion(value: string | undefined | null): BodyRegionCategory {
  const key = (value ?? '').trim().toLowerCase();
  return REGION_ALIASES[key] ?? 'Front torso';
}

/** Converts an anatomical region label to the canonical Spanish value expected by the backend and Supabase. */
export function toBackendBodyRegion(value: string | undefined | null): BackendBodyRegion {
  return BACKEND_BODY_REGIONS[normalizeBodyRegion(value)];
}
