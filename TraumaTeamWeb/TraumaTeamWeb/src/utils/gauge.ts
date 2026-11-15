/** Shared geometry of the five-band index bar used by the dashboard cards. */
export type BilateralBand =
  | 'low-critical'
  | 'low-warning'
  | 'normal'
  | 'high-warning'
  | 'high-critical';

export interface BilateralIndexRanges {
  lowCritical: string;
  lowWarning: string;
  normal: string;
  highWarning: string;
  highCritical: string;
}

/** Pointer position (0–100 %) for a band, `localRatio` being the position inside it. */
export function computeBilateralPointerPct(
  band: BilateralBand | null,
  localRatio = 0.5
): number {
  const clamped = Math.max(0, Math.min(1, localRatio));
  if (band === 'low-critical') return Math.round(4 + clamped * 11);
  if (band === 'low-warning') return Math.round(21 + clamped * 14);
  if (band === 'normal') return Math.round(41 + clamped * 18);
  if (band === 'high-warning') return Math.round(65 + clamped * 14);
  if (band === 'high-critical') return Math.round(85 + clamped * 11);
  return 0;
}
