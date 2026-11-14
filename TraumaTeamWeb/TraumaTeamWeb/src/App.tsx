import { useCallback, useEffect, useMemo, useState } from 'react';
import { AstronautProfileBar } from './components/AstronautProfileBar';
import { BodyModelViewerWeb } from './components/BodyModelViewerWeb';
import { HealthChartsPanel } from './components/HealthChartsPanel';
import {
  ActivityIcon,
  CheckIcon,
  ChevronRightIcon,
  LayersIcon,
  RegionCategoryIcon,
} from './components/Icons';

function getSeverityTag(intensity: number): string {
  if (intensity <= 3) return 'Leve';
  if (intensity <= 6) return 'Moderado';
  if (intensity <= 8) return 'Severo';
  return 'Crítico';
}
import { MuscleDetailAndAiPanel } from './components/MuscleDetailAndAiPanel';
import { RealtimeEcgMonitor } from './components/RealtimeEcgMonitor';
import { StartupSplashAnimation } from './components/StartupSplashAnimation';
import { SymptomPulseCards } from './components/SymptomPulseCards';
import {
  INITIAL_MUSCLES,
  PRIMARY_ASTRONAUT,
  getPainColorHex,
  getRiskTierFromIntensity,
} from './data/anatomy-catalog';
import {
  checkBackendHealth,
  extractLatestVitals,
  fetchBodyConditionsFromBackend,
  fetchDailyHealthChecksFromBackend,
  fetchInjuryPhotosFromBackend,
  fetchSamplesFromBackend,
  getInitialEmptyVitals,
} from './services/backend-api';
import type {
  AstronautProfile,
  BodyConditionRecord,
  ConnectionEndpointStatus,
  DailyHealthCheck,
  DashboardSample,
  InjuryPhoto,
  MuscleData,
  VitalSignsData,
} from './types/dashboard';

type ResponsiveStage = 'all' | 'signos' | 'visor' | 'musculo';

export function App() {
  const [introFinished, setIntroFinished] = useState<boolean>(false);
  const [astronauts] = useState<AstronautProfile[]>([PRIMARY_ASTRONAUT]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>(PRIMARY_ASTRONAUT.id);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [responsiveStage, setResponsiveStage] = useState<ResponsiveStage>('all');

  const [samples, setSamples] = useState<DashboardSample[]>([]);
  const [vitals, setVitals] = useState<VitalSignsData>(() => getInitialEmptyVitals());
  const [conditions, setConditions] = useState<BodyConditionRecord[]>([]);
  const [healthChecks, setHealthChecks] = useState<DailyHealthCheck[]>([]);
  const [photos, setPhotos] = useState<InjuryPhoto[]>([]);

  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [zoneSnapshots, setZoneSnapshots] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionEndpointStatus>({
    healthOk: false,
    samplesStatus: 'idle',
    bodyConditionsStatus: 'idle',
    healthChecksStatus: 'idle',
    photosStatus: 'idle',
    lastSyncIso: null,
    errorMessages: [],
  });

  const performSync = useCallback(async () => {
    const healthOk = await checkBackendHealth();

    const [samplesRes, condRes, checksRes, photosRes] = await Promise.allSettled([
      fetchSamplesFromBackend(500),
      fetchBodyConditionsFromBackend(500),
      fetchDailyHealthChecksFromBackend(100),
      fetchInjuryPhotosFromBackend(),
    ]);

    let nextSamplesStatus: ConnectionEndpointStatus['samplesStatus'] = 'ok';
    if (samplesRes.status === 'fulfilled') {
      setSamples(samplesRes.value);
      setVitals(extractLatestVitals(samplesRes.value));
    } else {
      nextSamplesStatus = 'error';
    }

    let nextCondStatus: ConnectionEndpointStatus['bodyConditionsStatus'] = 'ok';
    if (condRes.status === 'fulfilled') {
      const activeOnly = condRes.value.filter((c) => c.status === 'active');
      setConditions(activeOnly);
    } else {
      nextCondStatus = 'error';
    }

    let nextChecksStatus: ConnectionEndpointStatus['healthChecksStatus'] = 'ok';
    if (checksRes.status === 'fulfilled') {
      setHealthChecks(checksRes.value);
    } else {
      nextChecksStatus = 'error';
    }

    let nextPhotosStatus: ConnectionEndpointStatus['photosStatus'] = 'ok';
    if (photosRes.status === 'fulfilled') {
      setPhotos(photosRes.value.photos);
      if (!photosRes.value.available) {
        nextPhotosStatus = 'unavailable';
      }
    } else {
      nextPhotosStatus = 'error';
    }

    setConnectionStatus({
      healthOk,
      samplesStatus: nextSamplesStatus,
      bodyConditionsStatus: nextCondStatus,
      healthChecksStatus: nextChecksStatus,
      photosStatus: nextPhotosStatus,
      lastSyncIso: new Date().toISOString(),
      errorMessages: [],
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      await Promise.resolve();
      if (!mounted) return;
      await performSync();
    };
    void run();

    const interval = window.setInterval(() => {
      void performSync();
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [performSync]);

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    try {
      await performSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedAstronaut = useMemo(
    () => astronauts.find((a) => a.id === selectedAstronautId) ?? PRIMARY_ASTRONAUT,
    [astronauts, selectedAstronautId]
  );

  const muscles: MuscleData[] = useMemo(() => {
    const condMap = new Map<string, BodyConditionRecord>();
    for (const c of conditions) {
      if (c.status === 'active') {
        condMap.set(c.muscleId, c);
      }
    }

    return INITIAL_MUSCLES.map((base) => {
      const rec = condMap.get(base.id);
      if (!rec) return base;
      const tier = getRiskTierFromIntensity(rec.painIntensity);
      return {
        ...base,
        status: tier === 'red' ? 'critical' : 'warning',
        observation: {
          conditionName: rec.conditionName,
          painIntensity: rec.painIntensity,
          swelling: rec.swelling,
          functionalLimitation: rec.functionalLimitation,
          notes: rec.description ?? '',
          updatedAt: new Date(rec.updatedAt).toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          recordedAtIso: rec.recordedAt,
        },
      };
    });
  }, [conditions]);

  const selectedMuscle = useMemo(
    () => (selectedMuscleId ? muscles.find((m) => m.id === selectedMuscleId) ?? null : null),
    [muscles, selectedMuscleId]
  );

  const activeLesions = useMemo(
    () =>
      muscles
        .filter((m) => m.status !== 'normal' && Boolean(m.observation))
        .sort(
          (a, b) => (b.observation?.painIntensity ?? 0) - (a.observation?.painIntensity ?? 0)
        ),
    [muscles]
  );

  const latestHealthCheck = useMemo(() => {
    if (healthChecks.length === 0) return null;
    return healthChecks
      .slice()
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0];
  }, [healthChecks]);

  const globalRiskLevel: 'normal' | 'warning' | 'critical' = useMemo(() => {
    const hasRedLesion = activeLesions.some((m) => (m.observation?.painIntensity ?? 0) >= 7);
    const hasCriticalVitals =
      (vitals.heartRate !== null && (vitals.heartRate >= 115 || vitals.heartRate < 48)) ||
      (vitals.spo2 !== null && vitals.spo2 < 92) ||
      latestHealthCheck?.overallStatus === 'critical';

    if (hasRedLesion || hasCriticalVitals) return 'critical';

    const hasWarningVitals =
      (vitals.heartRate !== null && vitals.heartRate >= 100) ||
      (vitals.stress !== null && vitals.stress >= 70) ||
      (vitals.spo2 !== null && vitals.spo2 < 95) ||
      latestHealthCheck?.overallStatus === 'warning';

    if (activeLesions.length > 0 || hasWarningVitals) return 'warning';
    return 'normal';
  }, [activeLesions, vitals, latestHealthCheck]);

  const handleSelectMuscle = useCallback((muscleId: string | null) => {
    setSelectedMuscleId(muscleId);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setIntroFinished(true);
  }, []);

  if (!introFinished) {
    return <StartupSplashAnimation onComplete={handleIntroComplete} />;
  }

  return (
    <div className={`app-root theme-${themeMode}`}>
      <AstronautProfileBar
        astronauts={astronauts}
        selectedAstronautId={selectedAstronautId}
        onSelectAstronaut={(id) => setSelectedAstronautId(id)}
        connectionStatus={connectionStatus}
        globalRiskLevel={globalRiskLevel}
        activeLesionsCount={activeLesions.length}
        isSyncing={isSyncing}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((t) => (t === 'light' ? 'dark' : 'light'))}
        onManualRefresh={() => void handleManualRefresh()}
      />

      <div className="dashboard-shell">
        <nav className="stage-switcher-bar" aria-label="Vistas de tablet o móvil">
          <div className="stage-switcher-pills">
            {(
              [
                ['all', 'Todo'],
                ['signos', '1. Signos'],
                ['visor', '2. Visor 3D'],
                ['musculo', '3. Músculo e IA'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`stage-switch-btn ${responsiveStage === key ? 'active' : ''}`}
                onClick={() => setResponsiveStage(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {responsiveStage === 'visor' && selectedMuscle && (
            <button
              type="button"
              className="stage-jump-chip"
              onClick={() => setResponsiveStage('musculo')}
            >
              <span>Ver {selectedMuscle.name}</span>
              <ChevronRightIcon size={14} />
            </button>
          )}
        </nav>

        <main className={`stage-grid stage-mode-${responsiveStage}`}>
          {/* Columna 1: Misión arriba del Pulso + Signos/Síntomas + Tarjeta de Historial */}
          <div
            className={`stage-col ${
              responsiveStage === 'all' || responsiveStage === 'signos' ? 'visible' : 'hidden-sm'
            }`}
          >
            <RealtimeEcgMonitor vitals={vitals} astronaut={selectedAstronaut} />
            <SymptomPulseCards
              latestCheck={latestHealthCheck}
              muscles={muscles}
              vitals={vitals}
            />
            <HealthChartsPanel vitals={vitals} allSamples={samples} />
          </div>

          {/* Columna 2: Dropdown de Músculo + Cuerpo 3D estirado verticalmente */}
          <div
            className={`stage-col stage-col-viewer ${
              responsiveStage === 'all' || responsiveStage === 'visor' ? 'visible' : 'hidden-sm'
            }`}
          >
            <BodyModelViewerWeb
              muscles={muscles}
              selectedMuscleId={selectedMuscle?.id ?? null}
              onSelectMuscle={handleSelectMuscle}
              onZoneSnapshot={(zoneId, dataUrl) =>
                setZoneSnapshots((prev) => ({ ...prev, [zoneId]: dataUrl }))
              }
            />
          </div>

          {/* Columna 3: Síntomas en zona + Espacio IA + Fotos (Solo lectura) */}
          <div
            className={`stage-col ${
              responsiveStage === 'all' || responsiveStage === 'musculo' ? 'visible' : 'hidden-sm'
            }`}
          >
            <MuscleDetailAndAiPanel
              muscle={selectedMuscle}
              allMuscles={muscles}
              latestHealthCheck={latestHealthCheck}
              photos={photos}
              snapshotUri={selectedMuscle ? zoneSnapshots[selectedMuscle.id] : undefined}
              onSelectMuscle={handleSelectMuscle}
            />

            <section className="panel-card compact-card-block" aria-label="Zonas con síntomas reportados">
              <div className="compact-card-header">
                <span className="compact-card-title">Zonas con Síntomas</span>
                <span className="compact-count-pill">{activeLesions.length}</span>
              </div>

              {activeLesions.length === 0 ? (
                <div className="compact-empty-row">
                  <CheckIcon size={14} />
                  <span>Sin molestias musculares activas en móvil.</span>
                </div>
              ) : (
                <div className="active-records-list">
                  {activeLesions.map((m) => {
                    const pain = m.observation?.painIntensity ?? 0;
                    const painColor = getPainColorHex(pain);
                    const sevLabel = getSeverityTag(pain);
                    const isSelected = selectedMuscle?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`active-record-row ${isSelected ? 'selected' : ''}`}
                        style={{
                          borderColor: isSelected ? painColor : undefined,
                          boxShadow: isSelected ? `0 8px 18px -12px ${painColor}88` : undefined,
                        }}
                        onClick={() => handleSelectMuscle(m.id)}
                      >
                        <span
                          className="record-icon-box"
                          style={{
                            backgroundColor: `${painColor}18`,
                            borderColor: `${painColor}45`,
                            color: painColor,
                          }}
                        >
                          <RegionCategoryIcon category={m.category} size={15} />
                        </span>
                        <div className="record-text-col">
                          <div className="record-title-row">
                            <strong>{m.name}</strong>
                            <span
                              className="record-severity-pill"
                              style={{
                                backgroundColor: `${painColor}16`,
                                borderColor: `${painColor}40`,
                                color: painColor,
                              }}
                            >
                              {sevLabel}
                            </span>
                          </div>
                          <span className="record-subtext">
                            {m.category} · {m.observation?.conditionName || 'Sin detalle'}
                          </span>
                          {(m.observation?.swelling || m.observation?.functionalLimitation) && (
                            <div className="record-mini-flags">
                              {m.observation?.swelling && (
                                <span className="record-mini-flag">
                                  <LayersIcon size={10} /> Edema
                                </span>
                              )}
                              {m.observation?.functionalLimitation && (
                                <span className="record-mini-flag">
                                  <ActivityIcon size={10} /> Limitación
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRightIcon size={14} />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
