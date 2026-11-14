// Tipos para entorno espacial, misiones, rachas, fotos de lesiones y alertas críticas

export type EnvironmentType = 'tierra' | 'nave' | 'estacion' | 'luna' | 'marte';

export type SpaceLocation = 'tierra' | 'estacion' | 'luna' | 'marte';

export interface RouteDurationSpec {
  origen: SpaceLocation;
  destino: SpaceLocation;
  minDias: number;
  maxDias: number;
  promedioDias: number;
  ventanaLanzamientoMeses?: number;
  esperaRetornoDiasMin?: number;
  esperaRetornoDiasMax?: number;
}

export interface MissionSetup {
  origin: SpaceLocation;
  destination: SpaceLocation;
  departureDate: string; // YYYY-MM-DD
  arrivalDate?: string | null; // YYYY-MM-DD (opcional; si falta se estima)
}

export interface EnvironmentConfig {
  id: EnvironmentType;
  label: string;
  shortLabel: string;
  gravityLabel: string;
  destinationLabel: string;
  missionTotalDays: number;
  dailyStepsGoal: number;
  routineSummary: string;
}

export type MissionCategory = 'exercise' | 'steps' | 'treadmill' | 'checkin' | 'injury_check';

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  completed: boolean;
  environment: EnvironmentType | 'all';
}

export type AlertSeverity = 'critical' | 'warning';

export interface CriticalAlert {
  id: string;
  metric: 'heart_rate' | 'stress' | 'spo2' | 'health_check';
  title: string;
  message: string;
  valueLabel: string;
  severity: AlertSeverity;
  timestamp: string;
  acknowledged: boolean;
}

export type HealthStatusLevel = 'normal' | 'warning' | 'critical';

export interface DailyHealthCheck {
  id: string;
  dateIso: string; // YYYY-MM-DD
  recordedAt: string;
  bloodSugarMgDl: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  temperatureC: number | null;
  sleepHours: number | null;
  mood: 1 | 2 | 3 | 4 | 5;
  symptoms: string[];
  notes: string;
  overallStatus: HealthStatusLevel;
  recommendation: string;
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

