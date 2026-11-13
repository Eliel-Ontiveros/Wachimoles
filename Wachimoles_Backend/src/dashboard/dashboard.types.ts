import { Request } from "express";

export const SAMPLE_METRICS = [
  "heart_rate",
  "stress",
  "spo2",
  "steps"
] as const;

export type SampleMetric = (typeof SAMPLE_METRICS)[number];

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
