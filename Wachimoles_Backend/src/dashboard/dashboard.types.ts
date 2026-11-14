import { Request } from "express";

export const SAMPLE_METRICS = [
  "heart_rate",
  "stress",
  "spo2",
  "steps",
  "sleep"
] as const;

export type SampleMetric = (typeof SAMPLE_METRICS)[number];

export const BODY_REGION_CATEGORIES = [
  "Cabeza y cuello",
  "Tronco anterior",
  "Tronco posterior",
  "Extremidad superior",
  "Cadera y pelvis",
  "Extremidad inferior"
] as const;

export type BodyRegionCategory = (typeof BODY_REGION_CATEGORIES)[number];
export type BodyConditionStatus = "active" | "resolved";

export const HEALTH_STATUS_LEVELS = ["normal", "warning", "critical"] as const;
export type HealthStatusLevel = (typeof HEALTH_STATUS_LEVELS)[number];
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface DashboardRequest extends Request {
  dashboardUserId: string;
}

export interface DashboardSample {
  id: number;
  sampleId: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measuredAt: string;
  receivedAt: string;
}

export interface SamplesQuery {
  limit?: number;
  metric?: SampleMetric;
}

export interface BodyCondition {
  id: string;
  muscleId: string;
  bodyRegion: BodyRegionCategory;
  muscleName: string;
  conditionName: string;
  description: string | null;
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
  status: BodyConditionStatus;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface BodyConditionsQuery {
  limit?: number;
}

export const BODY_CONDITION_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadedBodyConditionImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface BodyConditionImage {
  path: string;
  signedUrl: string;
  expiresAt: string;
}

export interface DailyHealthCheck {
  id: string;
  dateIso: string;
  bloodSugarMgDl: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  temperatureC: number | null;
  sleepHours: number | null;
  mood: MoodScore;
  symptoms: string[];
  notes: string | null;
  overallStatus: HealthStatusLevel;
  recommendation: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyHealthChecksQuery {
  limit?: number;
}
