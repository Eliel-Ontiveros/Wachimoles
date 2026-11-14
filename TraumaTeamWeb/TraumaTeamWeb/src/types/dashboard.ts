export type SampleMetric = 'heart_rate' | 'stress' | 'spo2' | 'steps' | 'sleep';

export type BodyRegionCategory =
  | 'Cabeza y cuello'
  | 'Tronco anterior'
  | 'Tronco posterior'
  | 'Extremidad superior'
  | 'Cadera y pelvis'
  | 'Extremidad inferior';

export type BodyConditionStatus = 'active' | 'resolved';
export type MuscleStatus = 'normal' | 'warning' | 'critical';
export type RiskTier = 'normal' | 'yellow' | 'orange' | 'red';
export type HealthStatusLevel = 'normal' | 'warning' | 'critical';
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export type EnvironmentType = 'tierra' | 'nave' | 'luna' | 'marte';
export type SpaceLocation = 'tierra' | 'nave' | 'luna' | 'marte';

export interface DashboardSample {
  id: number;
  sampleId: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measuredAt: string;
  receivedAt: string;
}

export interface VitalSignsData {
  heartRate: number | null;
  spo2: number | null;
  stress: number | null;
  steps: number | null;
  sleepHours: number | null;
  lastMeasuredAt?: string;
  lastMeasuredIso?: string;
  isAvailable: boolean;
  pulseHistory: DashboardSample[];
  spo2History: DashboardSample[];
  stressHistory: DashboardSample[];
  sleepHistory: DashboardSample[];
  stepsHistory: DashboardSample[];
}

export interface BodyConditionRecord {
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

export interface SaveBodyConditionPayload {
  bodyRegion: BodyRegionCategory;
  muscleName: string;
  conditionName: string;
  description: string | null;
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
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

export interface BodyConditionImageRecord {
  path: string;
  signedUrl: string;
  expiresAt: string;
}

export interface InjuryPhoto {
  id: string;
  muscleId: string;
  muscleName: string;
  uri: string;
  dayNumber: number;
  capturedAt: string;
  painIntensity?: number;
  note?: string;
}

export interface MuscleObservation {
  conditionName: string;
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
  notes: string;
  updatedAt: string;
  recordedAtIso?: string;
}

export interface MuscleData {
  id: string;
  name: string;
  category: BodyRegionCategory;
  status: MuscleStatus;
  observation?: MuscleObservation;
  center: [number, number, number];
  radii: [number, number, number];
  normal: [number, number, number];
  cameraAngles: [number, number, number];
}

export interface AstronautProfile {
  id: string;
  userId: string;
  name: string;
  shortName: string;
  code: string;
  role: string;
  specialty: string;
  origin: SpaceLocation;
  destination: SpaceLocation;
  environment: EnvironmentType;
  gravityLabel: string;
  isPrimary: boolean;
}

export interface MuscleMedicalKnowledge {
  anatomicalSummary: string;
  biomechanicalRole: string;
  spaceflightImpact: string;
  keyStructures: string[];
  preventiveCountermeasure: string;
  yellowProtocol: string;
  redProtocol: string;
  ragReferences: {
    title: string;
    source: string;
    focus: string;
  }[];
}

export interface MuscleAiRecommendation {
  muscleId: string;
  muscleName: string;
  riskTier: RiskTier;
  riskLabel: string;
  clinicalSummary: string;
  differentialWarnings: string[];
  recommendedActions: string[];
  telemetryCorrelations: string[];
  references: {
    title: string;
    source: string;
    focus: string;
  }[];
}

export interface GlobalAiRagInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  reasoning: string;
  suggestedAction: string;
  evidenceSources: string[];
  relatedMuscleId?: string;
}

export interface DailyMetricSummary {
  dateKey: string;
  dateLabel: string;
  count: number;
  avg: number;
  max: number;
  maxTime: string;
  min: number;
  minTime: string;
}

export interface ConnectionEndpointStatus {
  healthOk: boolean;
  samplesStatus: 'ok' | 'unauthorized' | 'error' | 'idle';
  bodyConditionsStatus: 'ok' | 'unauthorized' | 'error' | 'idle';
  healthChecksStatus: 'ok' | 'unauthorized' | 'error' | 'idle';
  photosStatus: 'ok' | 'unavailable' | 'error' | 'idle';
  lastSyncIso: string | null;
  errorMessages: string[];
}
