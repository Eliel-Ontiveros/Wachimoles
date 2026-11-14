import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate, formatTime } from '@/i18n/format';
import { translate, type Locale, type MessageKey, type TranslateParams } from '@/i18n/messages';
import { useVitalSigns } from '../../hooks/use-vital-signs';
import {
  addDaysToIsoDate,
  AstronautMissionStatePayload,
  calculateMissionStateFromDeparture,
  cancelAstronautMissionInBackend,
  ENVIRONMENTS,
  extendMissionArrivalIso,
  fetchAstronautLocationFromBackend,
  fetchAstronautMissionStateFromBackend,
  fetchAstronautStreakFromBackend,
  fetchDailyMissionProgressFromBackend,
  fetchDailyMissionsFromBackend,
  getBodyConditionImagesFromBackend,
  getDailyHealthChecksFromBackend,
  getDateDaysAgoIso,
  getMissionsForEnvironment,
  getRouteTotalDays,
  getTodayIsoDate,
  localizeMission,
  markEarlyArrivalInBackend,
  saveAstronautLocationToBackend,
  syncAstronautMissionStateToBackend,
  syncDailyMissionsProgressToBackend,
  syncEnvironmentToBackend,
  syncHealthCheckToBackend,
  uploadBodyConditionImageToBackend,
} from '../../services/mission-api';
import { playStreakCheckin } from '../streak/streak-checkin';
import {
  CriticalAlert,
  DailyHealthCheck,
  DailyMission,
  EnvironmentType,
  InjuryPhoto,
  MissionExecutionStatus,
  MissionSetup,
  SpaceLocation,
} from '../../types/mission';
import { MissionContext } from './mission-context';

function buildMissionSyncPayload(
  origin: SpaceLocation,
  destination: SpaceLocation,
  departureDate: string,
  calc: ReturnType<typeof calculateMissionStateFromDeparture>
): AstronautMissionStatePayload {
  const status: MissionExecutionStatus = calc.arrived
    ? 'arrived'
    : calc.isScheduledFuture
      ? 'scheduled'
      : 'in_transit';
  const progressPct =
    calc.totalDays > 0
      ? Math.min(100, Math.round((calc.missionDay / Math.max(0.01, calc.totalDays)) * 10000) / 100)
      : 0;
  return {
    origen: origin,
    destino: destination,
    fechaSalida: departureDate,
    fechaLlegadaEstimada: calc.effectiveArrivalDate,
    diasTotales: calc.totalDays,
    diaActual: calc.missionDay,
    porcentajeProgresoRelativo: progressPct,
    entornoActual: calc.calculatedEnvironment,
    estado: status,
  };
}

async function persistMissionAndLocation(
  payload: AstronautMissionStatePayload,
  env: EnvironmentType
): Promise<void> {
  await syncAstronautMissionStateToBackend(payload);
  await saveAstronautLocationToBackend(env);
}

// Alerta guardada con claves de texto (no texto ya traducido) para que cambiar de idioma la actualice.
type StoredAlert = {
  id: string;
  metric: CriticalAlert['metric'];
  titleKey: MessageKey;
  messageKey?: MessageKey;
  messageText?: string;
  valueKey: MessageKey;
  valueParams?: TranslateParams;
  severity: CriticalAlert['severity'];
  at: number;
  acknowledged: boolean;
};

type NewStoredAlert = Omit<StoredAlert, 'id' | 'at' | 'acknowledged'>;

function formatNowLabel(locale: Locale, at: number = Date.now()) {
  return translate(locale, 'missions.today', { time: formatTime(at, locale) });
}

function formatHealthCheckRecordedAt(recordedAt: string, dateIso: string, locale: Locale) {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return recordedAt;

  const time = formatTime(date, locale);
  if (dateIso === getTodayIsoDate()) return time;
  return `${formatDate(date, locale, { dateStyle: 'short' })} · ${time}`;
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const { vitals, getFullHistory } = useVitalSigns(5000);
  const { locale } = useI18n();
  // Los textos que se guardan en estado (fechas, avisos) usan el idioma vigente al crearse.
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const [origin, setOrigin] = useState<SpaceLocation>('tierra');
  const [destination, setDestination] = useState<SpaceLocation>('luna');
  const [departureDate, setDepartureDate] = useState<string>(() => getTodayIsoDate());
  const [arrivalDate, setArrivalDate] = useState<string | null>(null);
  const [missionSetupOpen, setMissionSetupOpen] = useState<boolean>(false);
  const [flightPlanAccepted, setFlightPlanAccepted] = useState<boolean>(false);

  const [environment, setEnvironmentState] = useState<EnvironmentType>('tierra');
  const [streakDays, setStreakDays] = useState<number>(0);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(false);
  const [missionDay, setMissionDay] = useState<number>(0);
  const [treadmillRoutineActive, setTreadmillRoutineActive] = useState<boolean>(false);
  const [completedOverrides, setCompletedOverrides] = useState<Record<string, boolean>>({});
  const [backendDailyMissions, setBackendDailyMissions] = useState<DailyMission[] | null>(null);

  const [storedAlerts, setAlerts] = useState<StoredAlert[]>([]);
  const [activeStoredToaster, setActiveToasterAlert] = useState<StoredAlert | null>(null);
  const [injuryPhotos, setInjuryPhotos] = useState<Record<string, InjuryPhoto[]>>({});
  const [healthChecks, setHealthChecks] = useState<DailyHealthCheck[]>([]);

  const highStressCountRef = useRef(0);
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const locallyEditedHealthCheckDates = useRef(new Set<string>());
  const locallyModifiedMissionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    void getDailyHealthChecksFromBackend()
      .then((checks) => {
        if (!isMounted) return;
        const formattedChecks = checks.map((check) => ({
          ...check,
          recordedAt: formatHealthCheckRecordedAt(
            check.recordedAt,
            check.dateIso,
            localeRef.current
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
        console.warn('Could not load the daily questionnaires.', error);
        Alert.alert(
          translate(localeRef.current, 'missions.healthLoad.title'),
          translate(localeRef.current, 'missions.healthLoad.msg')
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Carga plan de vuelo activo y ubicación actual desde el backend al iniciar
  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      fetchAstronautMissionStateFromBackend(),
      fetchAstronautLocationFromBackend(),
    ])
      .then(([savedMission, savedLocation]) => {
        if (!isMounted || locallyModifiedMissionRef.current) return;

        const hasValidRoute = Boolean(savedMission && savedMission.origen !== savedMission.destino);
        const isMissionActiveInDb = Boolean(
          hasValidRoute &&
            savedMission &&
            (savedMission.estado === 'scheduled' || savedMission.estado === 'in_transit')
        );

        if (savedMission && isMissionActiveInDb) {
          const defaultDays = getRouteTotalDays(savedMission.origen, savedMission.destino);
          const estimatedDefaultArrival = addDaysToIsoDate(savedMission.fechaSalida, defaultDays);
          const storedCustomArrival =
            savedMission.fechaLlegadaEstimada &&
            savedMission.fechaLlegadaEstimada !== estimatedDefaultArrival
              ? savedMission.fechaLlegadaEstimada
              : null;

          const calc = calculateMissionStateFromDeparture(
            savedMission.origen,
            savedMission.destino,
            savedMission.fechaSalida,
            storedCustomArrival
          );

          setOrigin(savedMission.origen);
          setDestination(savedMission.destino);
          setDepartureDate(savedMission.fechaSalida);
          setArrivalDate(storedCustomArrival);
          setMissionDay(calc.missionDay);

          if (calc.arrived) {
            setFlightPlanAccepted(false);
            setEnvironmentState(savedMission.destino);
            const completedPayload = buildMissionSyncPayload(
              savedMission.origen,
              savedMission.destino,
              savedMission.fechaSalida,
              calc
            );
            void persistMissionAndLocation(completedPayload, savedMission.destino);
          } else {
            setFlightPlanAccepted(true);
            setEnvironmentState(calc.calculatedEnvironment);
            const syncedPayload = buildMissionSyncPayload(
              savedMission.origen,
              savedMission.destino,
              savedMission.fechaSalida,
              calc
            );
            if (
              savedMission.entornoActual !== calc.calculatedEnvironment ||
              savedMission.estado !== syncedPayload.estado ||
              Math.abs(savedMission.diaActual - calc.missionDay) > 0.01
            ) {
              void persistMissionAndLocation(syncedPayload, calc.calculatedEnvironment);
            }
          }
          return;
        }

        // Sin plan de vuelo activo: respetar la ubicación guardada independientemente en BD
        setFlightPlanAccepted(false);
        if (savedMission && hasValidRoute) {
          setOrigin(savedMission.origen);
          setDestination(savedMission.destino);
        }
        if (savedLocation) {
          setEnvironmentState(savedLocation.entorno);
        } else if (savedMission?.entornoActual) {
          setEnvironmentState(savedMission.entornoActual);
        }
      })
      .catch(() => {});

    // Carga racha acumulada y misiones completadas del día
    void fetchAstronautStreakFromBackend()
      .then((streak) => {
        if (!isMounted || !streak) return;
        setStreakDays(streak.rachaActual);
      })
      .catch(() => {});

    void fetchDailyMissionProgressFromBackend()
      .then((progreso) => {
        if (!isMounted || !progreso) return;
        if (progreso.racha) {
          setStreakDays(progreso.racha.rachaActual);
        }
        if (progreso.misiones) {
          setCompletedOverrides((prev) => ({ ...prev, ...progreso.misiones }));
          if (progreso.misiones['checkin-diario'] || progreso.misiones['daily-checkin']) {
            setCheckedInToday(true);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const pushCriticalAlert = useCallback(
    (alertData: NewStoredAlert & { metric: CriticalAlert['metric'] }) => {
      const now = Date.now();
      const prevTime = lastAlertTimeRef.current[alertData.metric] ?? 0;
      // Evita repetir el mismo pop-up cada 5s mientras persiste la lectura
      if (now - prevTime < 60000) return;

      lastAlertTimeRef.current[alertData.metric] = now;
      const newAlert: StoredAlert = {
        ...alertData,
        id: `${alertData.metric}-${now}`,
        at: now,
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
          titleKey: 'missions.alert.hrHigh.title',
          messageKey: 'missions.alert.hrHigh.msg',
          valueKey: 'missions.alert.bpm',
          valueParams: { n: vitals.heartRate },
          severity: 'critical',
        });
      } else if (vitals.heartRate > 0 && vitals.heartRate <= 45) {
        pushCriticalAlert({
          metric: 'heart_rate',
          titleKey: 'missions.alert.hrLow.title',
          messageKey: 'missions.alert.hrLow.msg',
          valueKey: 'missions.alert.bpm',
          valueParams: { n: vitals.heartRate },
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
          titleKey: 'missions.alert.stress.title',
          messageKey: 'missions.alert.stress.msg',
          valueKey: 'missions.alert.value',
          valueParams: { text: `${vitals.stress}/100` },
          severity: 'warning',
        });
      }
    }

    if (vitals.spo2 !== null && vitals.spo2 > 0 && vitals.spo2 < 90) {
      pushCriticalAlert({
        metric: 'spo2',
        titleKey: 'missions.alert.spo2.title',
        messageKey: 'missions.alert.spo2.msg',
        valueKey: 'missions.alert.value',
          valueParams: { text: `${vitals.spo2}%` },
        severity: 'critical',
      });
    }
  }, [vitals.heartRate, vitals.stress, vitals.spo2, pushCriticalAlert]);

  // Configura y acepta el plan de vuelo, automatizando la ubicación del astronauta en BD
  const configureMission = useCallback((setup: MissionSetup) => {
    if (setup.origin === setup.destination) return;
    locallyModifiedMissionRef.current = true;
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
    setFlightPlanAccepted(!calc.arrived);
    setMissionSetupOpen(false);

    const payload = buildMissionSyncPayload(
      setup.origin,
      setup.destination,
      setup.departureDate,
      calc
    );
    void persistMissionAndLocation(payload, calc.calculatedEnvironment);
  }, []);

  // Cancela el plan de vuelo aceptado y desbloquea la selección manual de ubicación en BD
  const cancelFlightPlan = useCallback(() => {
    locallyModifiedMissionRef.current = true;
    setFlightPlanAccepted(false);
    setArrivalDate(null);
    setMissionSetupOpen(false);
    void cancelAstronautMissionInBackend(environment, origin, destination);
  }, [environment, origin, destination]);

  // Solo permite cambiar la ubicación manualmente cuando no hay un plan de vuelo activo
  const setEnvironment = useCallback(
    (env: EnvironmentType): boolean => {
      if (flightPlanAccepted) {
        return false;
      }
      locallyModifiedMissionRef.current = true;
      setEnvironmentState(env);
      void syncEnvironmentToBackend(env);
      return true;
    },
    [flightPlanAccepted]
  );

  const doDailyCheckIn = useCallback(() => {
    if (!checkedInToday) {
      setCheckedInToday(true);
      setCompletedOverrides((prev) => ({
        ...prev,
        'checkin-diario': true,
        'daily-checkin': true,
      }));
    }
  }, [checkedInToday]);

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

  // Mantiene automatizada la ubicación mientras el plan de vuelo siga activo (al cambiar el día o volver a primer plano)
  useEffect(() => {
    if (!flightPlanAccepted) return;

    const syncProgress = () => {
      const calc = calculateMissionStateFromDeparture(
        origin,
        destination,
        departureDate,
        arrivalDate
      );
      if (calc.arrived) {
        setFlightPlanAccepted(false);
        setMissionDay(calc.totalDays);
        setEnvironmentState(destination);
        const payload = buildMissionSyncPayload(origin, destination, departureDate, calc);
        void persistMissionAndLocation(payload, destination);
        return;
      }
      if (calc.calculatedEnvironment !== environment || calc.missionDay !== missionDay) {
        setMissionDay(calc.missionDay);
        setEnvironmentState(calc.calculatedEnvironment);
        const payload = buildMissionSyncPayload(origin, destination, departureDate, calc);
        void persistMissionAndLocation(payload, calc.calculatedEnvironment);
      }
    };

    const interval = setInterval(syncProgress, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncProgress();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [flightPlanAccepted, origin, destination, departureDate, arrivalDate, environment, missionDay]);

  // Marca llegada anticipada al destino (solo válido cuando hay un plan de vuelo aceptado)
  const arriveEarly = useCallback((): boolean => {
    if (!flightPlanAccepted) {
      return false;
    }
    locallyModifiedMissionRef.current = true;
    const total = calculateMissionStateFromDeparture(
      origin,
      destination,
      departureDate,
      arrivalDate
    ).totalDays;
    const nextEnv: EnvironmentType = destination;
    const todayIso = getTodayIsoDate();

    setFlightPlanAccepted(false);
    setArrivalDate(null);
    setDepartureDate(getDateDaysAgoIso(total));
    setMissionDay(total);
    setEnvironmentState(nextEnv);
    setMissionSetupOpen(false);
    void (async () => {
      await markEarlyArrivalInBackend(todayIso);
      await saveAstronautLocationToBackend(nextEnv);
    })();
    return true;
  }, [flightPlanAccepted, origin, destination, departureDate, arrivalDate]);

  // Extiende la fecha de llegada en caso de atraso de la misión (solo con plan de vuelo aceptado)
  const delayMission = useCallback(
    (extraDays: number): boolean => {
      if (!flightPlanAccepted || extraDays <= 0) return false;
      locallyModifiedMissionRef.current = true;
      const nextArrival = extendMissionArrivalIso(
        departureDate,
        effectiveArrivalDate,
        extraDays
      );
      setArrivalDate(nextArrival);
      const calc = calculateMissionStateFromDeparture(
        origin,
        destination,
        departureDate,
        nextArrival
      );
      setMissionDay(calc.missionDay);
      setEnvironmentState(calc.calculatedEnvironment);
      if (calc.arrived) {
        setFlightPlanAccepted(false);
      }
      const payload = buildMissionSyncPayload(origin, destination, departureDate, calc);
      void persistMissionAndLocation(payload, calc.calculatedEnvironment);
      return true;
    },
    [flightPlanAccepted, departureDate, effectiveArrivalDate, origin, destination]
  );

  const toggleTreadmillRoutine = useCallback(() => {
    setTreadmillRoutineActive((prev) => !prev);
  }, []);

  const toggleMission = useCallback(
    (id: string) => {
      if (id === 'daily-checkin' || id === 'checkin-diario') {
        doDailyCheckIn();
        return;
      }
      if (id === 'treadmill-steps' || id.includes('treadmill')) {
        toggleTreadmillRoutine();
        return;
      }
      if (id === 'daily-steps' || id.includes('pasos')) return;
      setCompletedOverrides((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    [doDailyCheckIn, toggleTreadmillRoutine]
  );

  // Consulta misiones rotativas y aleatorias con dificultad desde el backend
  useEffect(() => {
    let isMounted = true;
    void fetchDailyMissionsFromBackend(
      environment,
      vitals.steps,
      checkedInToday,
      treadmillRoutineActive
    ).then((retrieved) => {
      if (isMounted && retrieved.length > 0) {
        setBackendDailyMissions(retrieved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [environment]);

  const missions = useMemo(() => {
    const baseMissions =
      backendDailyMissions && backendDailyMissions.length > 0
        ? backendDailyMissions.map((raw) => {
            const m = localizeMission(raw, locale, environment, treadmillRoutineActive);
            let currentValue = m.currentValue;
            let completed = m.completed;
            if (m.category === 'checkin') {
              currentValue = checkedInToday ? 1 : 0;
              completed = checkedInToday;
            } else if (m.category === 'steps') {
              currentValue = vitals.steps;
              completed = vitals.steps >= m.targetValue;
            } else if (m.category === 'treadmill') {
              currentValue = treadmillRoutineActive ? vitals.steps : 0;
              completed = treadmillRoutineActive && vitals.steps >= m.targetValue;
            }
            return { ...m, currentValue, completed };
          })
        : getMissionsForEnvironment(
            environment,
            vitals.steps,
            checkedInToday,
            treadmillRoutineActive,
            locale
          );

    return baseMissions.map((m) => {
      if (completedOverrides[m.id] !== undefined) {
        const done = completedOverrides[m.id];
        return { ...m, completed: done, currentValue: done ? m.targetValue : m.currentValue };
      }
      return m;
    });
  }, [
    backendDailyMissions,
    environment,
    vitals.steps,
    checkedInToday,
    treadmillRoutineActive,
    completedOverrides,
    locale,
  ]);

  // Sincroniza cumplimiento de misiones con la base de datos y otorga racha al completar todas
  const streakPointAwardedTodayRef = useRef(false);
  useEffect(() => {
    if (missions.length === 0) return;

    void syncDailyMissionsProgressToBackend(missions).then((res) => {
      if (!res) return;
      if (res.racha) {
        setStreakDays(res.racha.rachaActual);
      }
      if (res.puntoRachaOtorgado && !streakPointAwardedTodayRef.current) {
        streakPointAwardedTodayRef.current = true;
        playStreakCheckin({
          streak: res.racha.rachaActual,
          todayIndex: new Date().getDay(),
        });
      }
    });
  }, [missions]);

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
          todayIso,
          localeRef.current
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
            translate(localeRef.current, 'missions.healthSave.title'),
            translate(localeRef.current, 'missions.healthSave.msg')
          );
        }
      });

      if (entry.overallStatus === 'critical') {
        pushCriticalAlert({
          metric: 'health_check',
          titleKey: 'missions.alert.health.title',
          messageText: entry.recommendation,
          valueKey: 'missions.alert.health.value',
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
      photo: {
        uri: string;
        fileName?: string;
        mimeType?: string;
        painIntensity?: number;
        note?: string;
      }
    ): Promise<InjuryPhoto> => {
      const existing = injuryPhotos[muscleId] ?? [];
      const nextDay = existing.length + 1;
      const uploadedImage = await uploadBodyConditionImageToBackend(muscleId, photo);
      const entry: InjuryPhoto = {
        id: uploadedImage.path,
        muscleId,
        muscleName,
        uri: uploadedImage.signedUrl,
        dayNumber: nextDay,
        capturedAt: formatNowLabel(localeRef.current),
        painIntensity: photo.painIntensity,
        note: photo.note,
      };
      setInjuryPhotos((prev) => ({
        ...prev,
        [muscleId]: [...(prev[muscleId] ?? []), entry],
      }));
      return entry;
    },
    [injuryPhotos]
  );

  const refreshInjuryPhotos = useCallback(
    async (muscleId: string, muscleName: string): Promise<InjuryPhoto[]> => {
      const images = await getBodyConditionImagesFromBackend(muscleId);
      const photos = images
        .slice()
        .reverse()
        .map((image, index) => ({
          id: image.path,
          muscleId,
          muscleName,
          uri: image.signedUrl,
          dayNumber: index + 1,
          capturedAt: translate(localeRef.current, 'missions.photo.saved'),
        }));
      setInjuryPhotos((prev) => ({ ...prev, [muscleId]: photos }));
      return photos;
    },
    []
  );

  // Traduce al vuelo: cambiar de idioma actualiza también las alertas ya generadas.
  const localizeAlert = useCallback(
    (a: StoredAlert): CriticalAlert => ({
      id: a.id,
      metric: a.metric,
      title: translate(locale, a.titleKey),
      message: a.messageKey ? translate(locale, a.messageKey) : (a.messageText ?? ''),
      valueLabel: translate(locale, a.valueKey, a.valueParams),
      severity: a.severity,
      timestamp: formatNowLabel(locale, a.at),
      acknowledged: a.acknowledged,
    }),
    [locale]
  );
  const alerts = useMemo(() => storedAlerts.map(localizeAlert), [storedAlerts, localizeAlert]);
  const activeToasterAlert = useMemo(
    () => (activeStoredToaster ? localizeAlert(activeStoredToaster) : null),
    [activeStoredToaster, localizeAlert]
  );

  const unreadAlertCount = useMemo(
    () => storedAlerts.filter((a) => !a.acknowledged).length,
    [storedAlerts]
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
      flightPlanAccepted,
      openMissionSetup,
      closeMissionSetup,
      configureMission,
      cancelFlightPlan,
      arriveEarly,
      delayMission,
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
      refreshInjuryPhotos,
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
      flightPlanAccepted,
      openMissionSetup,
      closeMissionSetup,
      configureMission,
      cancelFlightPlan,
      arriveEarly,
      delayMission,
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
      refreshInjuryPhotos,
      healthChecks,
      submitHealthCheck,
    ]
  );

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

