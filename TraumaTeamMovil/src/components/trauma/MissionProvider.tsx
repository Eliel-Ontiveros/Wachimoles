import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useVitalSigns } from '../../hooks/use-vital-signs';
import {
  calculateMissionStateFromDeparture,
  ENVIRONMENTS,
  getDateDaysAgoIso,
  getMissionsForEnvironment,
  getRouteTotalDays,
  getTodayIsoDate,
  getDailyHealthChecksFromBackend,
  syncEnvironmentToBackend,
  syncHealthCheckToBackend,
  uploadInjuryPhotoToBackend,
} from '../../services/mission-api';
import {
  CriticalAlert,
  DailyHealthCheck,
  EnvironmentType,
  InjuryPhoto,
  MissionSetup,
  SpaceLocation,
} from '../../types/mission';
import { MissionContext } from './mission-context';

function formatNowLabel() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `Hoy · ${hh}:${mm}`;
}

function formatHealthCheckRecordedAt(recordedAt: string, dateIso: string) {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return recordedAt;

  const time = date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (dateIso === getTodayIsoDate()) return time;
  return `${date.toLocaleDateString('es-MX')} · ${time}`;
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const { vitals, getFullHistory } = useVitalSigns(5000);

  const [origin, setOrigin] = useState<SpaceLocation>('tierra');
  const [destination, setDestination] = useState<SpaceLocation>('luna');
  const [departureDate, setDepartureDate] = useState<string>(() => getTodayIsoDate());
  const [arrivalDate, setArrivalDate] = useState<string | null>(null);
  const [missionSetupOpen, setMissionSetupOpen] = useState<boolean>(false);

  const [environment, setEnvironmentState] = useState<EnvironmentType>('nave');
  const [streakDays, setStreakDays] = useState<number>(0);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(false);
  const [missionDay, setMissionDay] = useState<number>(0);
  const [treadmillRoutineActive, setTreadmillRoutineActive] = useState<boolean>(false);
  const [completedOverrides, setCompletedOverrides] = useState<Record<string, boolean>>({});

  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [activeToasterAlert, setActiveToasterAlert] = useState<CriticalAlert | null>(null);
  const [injuryPhotos, setInjuryPhotos] = useState<Record<string, InjuryPhoto[]>>({});
  const [healthChecks, setHealthChecks] = useState<DailyHealthCheck[]>([]);

  const highStressCountRef = useRef(0);
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const locallyEditedHealthCheckDates = useRef(new Set<string>());

  useEffect(() => {
    let isMounted = true;
    void getDailyHealthChecksFromBackend()
      .then((checks) => {
        if (!isMounted) return;
        const formattedChecks = checks.map((check) => ({
          ...check,
          recordedAt: formatHealthCheckRecordedAt(
            check.recordedAt,
            check.dateIso
          ),
        }));
        setHealthChecks((currentChecks) => {
          const checksByDate = new Map(
            formattedChecks.map((check) => [check.dateIso, check])
          );
          for (const localCheck of currentChecks) {
            if (locallyEditedHealthCheckDates.current.has(localCheck.dateIso)) {
              checksByDate.set(localCheck.dateIso, localCheck);
            }
          }
          return [...checksByDate.values()].sort((a, b) =>
            b.dateIso.localeCompare(a.dateIso)
          );
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.error('No se pudieron cargar los cuestionarios diarios.', error);
        Alert.alert(
          'No se pudo cargar el cuestionario',
          'Revisa la conexión con el backend e inténtalo de nuevo.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const pushCriticalAlert = useCallback(
    (alertData: Omit<CriticalAlert, 'id' | 'timestamp' | 'acknowledged'>) => {
      const now = Date.now();
      const prevTime = lastAlertTimeRef.current[alertData.metric] ?? 0;
      // Evita repetir el mismo pop-up cada 5s mientras persiste la lectura
      if (now - prevTime < 60000) return;

      lastAlertTimeRef.current[alertData.metric] = now;
      const newAlert: CriticalAlert = {
        ...alertData,
        id: `${alertData.metric}-${now}`,
        timestamp: formatNowLabel(),
        acknowledged: false,
      };
      setAlerts((prev) => [newAlert, ...prev]);
      setActiveToasterAlert(newAlert);
    },
    []
  );

  // Vigila signos vitales reales para disparar alertas solo ante anomalías graves
  useEffect(() => {
    if (vitals.heartRate !== null) {
      if (vitals.heartRate >= 120) {
        pushCriticalAlert({
          metric: 'heart_rate',
          title: 'Pico de ritmo cardíaco',
          message: 'Frecuencia cardíaca elevada detectada por el reloj.',
          valueLabel: `${vitals.heartRate} Lpm`,
          severity: 'critical',
        });
      } else if (vitals.heartRate > 0 && vitals.heartRate <= 45) {
        pushCriticalAlert({
          metric: 'heart_rate',
          title: 'Bradicardia detectada',
          message: 'Frecuencia cardíaca por debajo del umbral seguro.',
          valueLabel: `${vitals.heartRate} Lpm`,
          severity: 'critical',
        });
      }
    }

    if (vitals.stress !== null) {
      if (vitals.stress >= 75) {
        highStressCountRef.current += 1;
      } else {
        highStressCountRef.current = 0;
      }

      if (vitals.stress >= 85 || highStressCountRef.current >= 3) {
        pushCriticalAlert({
          metric: 'stress',
          title: 'Estrés prolongado crítico',
          message: 'Nivel de estrés sostenido. Se recomienda pausa de respiración.',
          valueLabel: `${vitals.stress}/100`,
          severity: 'warning',
        });
      }
    }

    if (vitals.spo2 !== null && vitals.spo2 > 0 && vitals.spo2 < 90) {
      pushCriticalAlert({
        metric: 'spo2',
        title: 'Desaturación de oxígeno',
        message: 'SpO2 por debajo del 90%. Verificar suministro o sensor.',
        valueLabel: `${vitals.spo2}%`,
        severity: 'critical',
      });
    }
  }, [vitals.heartRate, vitals.stress, vitals.spo2, pushCriticalAlert]);

  // Configura la misión inicial y calcula automáticamente día y ubicación del astronauta
  const configureMission = useCallback((setup: MissionSetup) => {
    if (setup.origin === setup.destination) return;
    setOrigin(setup.origin);
    setDestination(setup.destination);
    setDepartureDate(setup.departureDate);
    setArrivalDate(setup.arrivalDate ?? null);

    const calc = calculateMissionStateFromDeparture(
      setup.origin,
      setup.destination,
      setup.departureDate,
      setup.arrivalDate ?? null
    );
    setMissionDay(calc.missionDay);
    setEnvironmentState(calc.calculatedEnvironment);
    setMissionSetupOpen(false);
    void syncEnvironmentToBackend(calc.calculatedEnvironment);
  }, []);

  // Al cambiar manualmente la ubicación a Base Lunar o Marte, se adelanta la misión a su llegada
  const setEnvironment = useCallback(
    (env: EnvironmentType) => {
      setEnvironmentState(env);
      setArrivalDate(null);
      if (env === 'luna' || env === 'marte') {
        const nextOrigin = origin === env ? 'tierra' : origin;
        if (origin === env) setOrigin('tierra');
        setDestination(env);
        setMissionDay(getRouteTotalDays(nextOrigin, env));
      } else if (env === 'tierra') {
        if (destination === 'tierra') {
          setMissionDay(getRouteTotalDays(origin, 'tierra'));
        } else {
          setOrigin('tierra');
          setMissionDay(0);
        }
      } else {
        const calc = calculateMissionStateFromDeparture(origin, destination, departureDate);
        const total = getRouteTotalDays(origin, destination);
        setMissionDay(calc.missionDay >= total ? 0 : calc.missionDay);
      }
      void syncEnvironmentToBackend(env);
    },
    [origin, destination, departureDate]
  );

  const doDailyCheckIn = useCallback(() => {
    if (!checkedInToday) {
      setCheckedInToday(true);
      setStreakDays((d) => d + 1);
      setMissionDay((d) => {
        const total = calculateMissionStateFromDeparture(
          origin,
          destination,
          departureDate,
          arrivalDate
        ).totalDays;
        const nextDay = Math.min(total, d + 1);
        if (nextDay >= total && destination !== 'nave') {
          setEnvironmentState(destination);
        }
        return nextDay;
      });
    }
  }, [checkedInToday, origin, destination, departureDate, arrivalDate]);

  const missionTiming = useMemo(
    () =>
      calculateMissionStateFromDeparture(
        origin,
        destination,
        departureDate,
        arrivalDate
      ),
    [origin, destination, departureDate, arrivalDate]
  );
  const {
    daysUntilDeparture,
    effectiveArrivalDate,
    isEstimatedArrival,
    totalDays: totalMissionDays,
  } = missionTiming;

  // Marca llegada anticipada al destino actual
  const arriveEarly = useCallback(() => {
    const total = getRouteTotalDays(origin, destination);
    const nextEnv: EnvironmentType = destination;
    setArrivalDate(null);
    setDepartureDate(getDateDaysAgoIso(total));
    setMissionDay(total);
    setEnvironmentState(nextEnv);
    setMissionSetupOpen(false);
    void syncEnvironmentToBackend(nextEnv);
  }, [origin, destination]);

  const toggleTreadmillRoutine = useCallback(() => {
    setTreadmillRoutineActive((prev) => !prev);
  }, []);

  const toggleMission = useCallback(
    (id: string) => {
      if (id === 'daily-checkin') {
        doDailyCheckIn();
        return;
      }
      if (id === 'treadmill-steps') {
        toggleTreadmillRoutine();
        return;
      }
      if (id === 'daily-steps') return;
      setCompletedOverrides((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    [doDailyCheckIn, toggleTreadmillRoutine]
  );

  const missions = useMemo(() => {
    return getMissionsForEnvironment(
      environment,
      vitals.steps,
      checkedInToday,
      treadmillRoutineActive
    ).map((m) => {
      if (m.category === 'exercise' && completedOverrides[m.id] !== undefined) {
        const done = completedOverrides[m.id];
        return { ...m, completed: done, currentValue: done ? m.targetValue : 0 };
      }
      return m;
    });
  }, [environment, vitals.steps, checkedInToday, treadmillRoutineActive, completedOverrides]);

  const submitHealthCheck = useCallback(
    (checkData: Omit<DailyHealthCheck, 'id' | 'dateIso' | 'recordedAt'>): DailyHealthCheck => {
      const todayIso = getTodayIsoDate();
      locallyEditedHealthCheckDates.current.add(todayIso);
      const entry: DailyHealthCheck = {
        ...checkData,
        id: `hc-${todayIso}`,
        dateIso: todayIso,
        recordedAt: formatHealthCheckRecordedAt(
          new Date().toISOString(),
          todayIso
        ),
      };
      setHealthChecks((prev) => {
        const existsIdx = prev.findIndex((c) => c.dateIso === todayIso);
        if (existsIdx >= 0) {
          return prev.map((c, idx) => (idx === existsIdx ? { ...entry, id: c.id } : c));
        }
        return [entry, ...prev];
      });
      if (!checkedInToday) {
        doDailyCheckIn();
      }
      void syncHealthCheckToBackend(entry).then(({ synced }) => {
        if (!synced) {
          Alert.alert(
            'No se guardó el cuestionario',
            'El cuestionario se actualizó en pantalla, pero no pudo guardarse en el servidor. Revisa la conexión antes de cerrar la app.'
          );
        }
      });

      if (entry.overallStatus === 'critical') {
        pushCriticalAlert({
          metric: 'health_check',
          title: 'Revisión médica prioritaria',
          message: entry.recommendation,
          valueLabel: 'Crítico',
          severity: 'critical',
        });
      }
      return entry;
    },
    [pushCriticalAlert, checkedInToday, doDailyCheckIn]
  );

  const dismissToaster = useCallback(() => {
    setActiveToasterAlert(null);
  }, []);

  const acknowledgeAllAlerts = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    setActiveToasterAlert(null);
  }, []);

  const addInjuryPhoto = useCallback(
    async (
      muscleId: string,
      muscleName: string,
      photo: { uri: string; painIntensity?: number; note?: string }
    ): Promise<InjuryPhoto> => {
      const existing = injuryPhotos[muscleId] ?? [];
      const nextDay = existing.length + 1;
      const entry: InjuryPhoto = {
        id: `photo-${muscleId}-${Date.now()}`,
        muscleId,
        muscleName,
        uri: photo.uri,
        dayNumber: nextDay,
        capturedAt: formatNowLabel(),
        painIntensity: photo.painIntensity,
        note: photo.note,
      };
      setInjuryPhotos((prev) => ({
        ...prev,
        [muscleId]: [...(prev[muscleId] ?? []), entry],
      }));
      void uploadInjuryPhotoToBackend({
        muscleId,
        muscleName,
        uri: photo.uri,
        dayNumber: nextDay,
        capturedAt: entry.capturedAt,
        painIntensity: photo.painIntensity,
        note: photo.note,
      });
      return entry;
    },
    [injuryPhotos]
  );

  const unreadAlertCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  const openMissionSetup = useCallback(() => setMissionSetupOpen(true), []);
  const closeMissionSetup = useCallback(() => setMissionSetupOpen(false), []);

  const value = useMemo(
    () => ({
      environment,
      environmentConfig: ENVIRONMENTS[environment],
      origin,
      destination,
      departureDate,
      arrivalDate,
      effectiveArrivalDate,
      isEstimatedArrival,
      totalMissionDays,
      daysUntilDeparture,
      missionSetupOpen,
      openMissionSetup,
      closeMissionSetup,
      configureMission,
      arriveEarly,
      setEnvironment,
      streakDays,
      checkedInToday,
      missionDay,
      treadmillRoutineActive,
      toggleTreadmillRoutine,
      doDailyCheckIn,
      missions,
      toggleMission,
      vitals,
      getFullHistory,
      alerts,
      unreadAlertCount,
      activeToasterAlert,
      dismissToaster,
      acknowledgeAllAlerts,
      injuryPhotos,
      addInjuryPhoto,
      healthChecks,
      submitHealthCheck,
    }),
    [
      environment,
      origin,
      destination,
      departureDate,
      arrivalDate,
      effectiveArrivalDate,
      isEstimatedArrival,
      totalMissionDays,
      daysUntilDeparture,
      missionSetupOpen,
      openMissionSetup,
      closeMissionSetup,
      configureMission,
      arriveEarly,
      setEnvironment,
      streakDays,
      checkedInToday,
      missionDay,
      treadmillRoutineActive,
      toggleTreadmillRoutine,
      doDailyCheckIn,
      missions,
      toggleMission,
      vitals,
      getFullHistory,
      alerts,
      unreadAlertCount,
      activeToasterAlert,
      dismissToaster,
      acknowledgeAllAlerts,
      injuryPhotos,
      addInjuryPhoto,
      healthChecks,
      submitHealthCheck,
    ]
  );

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

