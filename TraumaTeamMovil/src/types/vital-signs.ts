// Tipos de datos para signos vitales y muestras del sensor
export type SampleMetric = 'heart_rate' | 'stress' | 'spo2' | 'steps';

/** Estructura exacta de una muestra devuelta por la API NestJS / Supabase */
export interface DashboardSample {
  id: number;
  sampleId: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measuredAt: string; // ISO 8601 UTC
  receivedAt: string; // ISO 8601 UTC
}

/** Estado procesado para la pantalla de Monitoreo Vital */
export interface VitalSignsData {
  /** Frecuencia cardíaca en Lpm o null si no está disponible */
  heartRate: number | null;
  /** Nivel de saturación de oxígeno en sangre (0-100%) o null */
  spo2: number | null;
  /** Nivel de estrés (0-100) o null */
  stress: number | null;
  /** Contador de pasos del día */
  steps: number;
  /** Texto legible de la última medición (ej: "Hace 2 min" o "17:08") */
  lastMeasuredAt?: string;
  /** Indica si hay datos reales del sensor activos */
  isAvailable: boolean;
  /** Lista histórica de muestras de pulso */
  pulseHistory: DashboardSample[];
  /** Lista histórica de muestras de oxígeno (SpO2) */
  spo2History: DashboardSample[];
  /** Lista histórica de muestras de estrés */
  stressHistory: DashboardSample[];
}

/** Estado de conexión con el backend */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
