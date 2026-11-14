import { createContext, useContext } from 'react';
import { DashboardSample, SampleMetric, VitalSignsData } from '../../types/vital-signs';
import {
  CriticalAlert,
  DailyHealthCheck,
  DailyMission,
  EnvironmentConfig,
  EnvironmentType,
  InjuryPhoto,
  MissionSetup,
  SpaceLocation,
} from '../../types/mission';

export type MissionCtx = {
  environment: EnvironmentType;
  environmentConfig: EnvironmentConfig;
  origin: SpaceLocation;
  destination: SpaceLocation;
  departureDate: string;
  arrivalDate: string | null;
  effectiveArrivalDate: string;
  isEstimatedArrival: boolean;
  totalMissionDays: number;
  daysUntilDeparture: number;
  missionSetupOpen: boolean;
  openMissionSetup: () => void;
  closeMissionSetup: () => void;
  configureMission: (setup: MissionSetup) => void;
  arriveEarly: () => void;
  setEnvironment: (env: EnvironmentType) => void;
  streakDays: number;
  checkedInToday: boolean;
  missionDay: number;
  treadmillRoutineActive: boolean;
  toggleTreadmillRoutine: () => void;
  doDailyCheckIn: () => void;
  missions: DailyMission[];
  toggleMission: (id: string) => void;
  vitals: VitalSignsData;
  getFullHistory: (metric?: SampleMetric) => Promise<DashboardSample[]>;
  alerts: CriticalAlert[];
  unreadAlertCount: number;
  activeToasterAlert: CriticalAlert | null;
  dismissToaster: () => void;
  acknowledgeAllAlerts: () => void;
  injuryPhotos: Record<string, InjuryPhoto[]>;
  addInjuryPhoto: (
    muscleId: string,
    muscleName: string,
    photo: {
      uri: string;
      fileName?: string;
      mimeType?: string;
      painIntensity?: number;
      note?: string;
    }
  ) => Promise<InjuryPhoto>;
  refreshInjuryPhotos: (muscleId: string, muscleName: string) => Promise<InjuryPhoto[]>;
  healthChecks: DailyHealthCheck[];
  submitHealthCheck: (check: Omit<DailyHealthCheck, 'id' | 'dateIso' | 'recordedAt'>) => DailyHealthCheck;
};

export const MissionContext = createContext<MissionCtx | null>(null);

export function useMission() {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission debe usarse dentro de <MissionProvider>');
  return ctx;
}

