import { useCallback, useEffect, useMemo, useState } from 'react';
import { AstronautProfileBar } from './components/AstronautProfileBar';
import { BodyModelViewerWeb } from './components/BodyModelViewerWeb';
import { HealthChartsPanel } from './components/HealthChartsPanel';
import { HexagonalVaultBackground } from './components/HexagonalVaultBackground';
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
  cureBodyConditionWithHistoryInBackend,
  extractLatestVitals,
  fetchBodyConditionImagesFromBackend,
  fetchBodyConditionsFromBackend,
  fetchDailyHealthChecksFromBackend,
  fetchInjuryPhotosFromBackend,
  fetchSamplesFromBackend,
  getInitialEmptyVitals,
  saveBodyConditionToBackend,
  uploadBodyConditionImageToBackend,
} from './services/backend-api';
import {
  appendConditionUpdate,
  formatShortUpdateDate,
  parseConditionUpdates,
} from './utils/condition-updates';
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

export interface SaveMuscleUpdateInput {
  updateText: string;
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
  photoFile?: File | null;
  isCured?: boolean;
}

type ResponsiveStage = 'all' | 'signos' | 'visor' | 'musculo';

export function App() {
  const [introFinished, setIntroFinished] = useState<boolean>(false);
  const [astronauts] = useState<AstronautProfile[]>([PRIMARY_ASTRONAUT]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>(PRIMARY_ASTRONAUT.id);
  const themeMode = 'light' as const;
  const [responsiveStage, setResponsiveStage] = useState<ResponsiveStage>('all');
  const [symptomsViewTab, setSymptomsViewTab] = useState<'active' | 'history'>('active');

  const [samples, setSamples] = useState<DashboardSample[]>([]);
  const [vitals, setVitals] = useState<VitalSignsData>(() => getInitialEmptyVitals());
  const [conditions, setConditions] = useState<BodyConditionRecord[]>([]);
  const [healthChecks, setHealthChecks] = useState<DailyHealthCheck[]>([]);
  const [photos, setPhotos] = useState<InjuryPhoto[]>([]);

  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [zoneSnapshots, setZoneSnapshots] = useState<Record<string, string>>({});

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
    let syncedConditions: BodyConditionRecord[] = [];
    if (condRes.status === 'fulfilled') {
      syncedConditions = condRes.value;
      setConditions(syncedConditions);
    } else {
      nextCondStatus = 'error';
    }

    let nextChecksStatus: ConnectionEndpointStatus['healthChecksStatus'] = 'ok';
    if (checksRes.status === 'fulfilled') {
      setHealthChecks(checksRes.value);
    } else {
      nextChecksStatus = 'error';
    }

    // Cargar fotos subidas por zona en Supabase Storage (/dashboard/body-conditions/:muscleId/images)
    const storagePhotos: InjuryPhoto[] = [];
    if (syncedConditions.length > 0) {
      const uniqueZones = new Map<string, string>();
      for (const rec of syncedConditions) {
        if (!uniqueZones.has(rec.muscleId)) {
          uniqueZones.set(rec.muscleId, rec.muscleName);
        }
      }
      const imageEntries = Array.from(uniqueZones.entries());
      const imageResults = await Promise.allSettled(
        imageEntries.map(([mId]) => fetchBodyConditionImagesFromBackend(mId))
      );

      imageResults.forEach((result, idx) => {
        if (result.status !== 'fulfilled') return;
        const [mId, mName] = imageEntries[idx];
        const chronological = result.value.slice().reverse();
        chronological.forEach((img, photoIndex) => {
          storagePhotos.push({
            id: img.path,
            muscleId: mId,
            muscleName: mName,
            uri: img.signedUrl,
            dayNumber: photoIndex + 1,
            capturedAt: img.expiresAt,
            note: `Actualización ${photoIndex + 1}`,
          });
        });
      });
    }

    let nextPhotosStatus: ConnectionEndpointStatus['photosStatus'] = 'ok';
    const basePhotos = photosRes.status === 'fulfilled' ? photosRes.value.photos : [];
    if (photosRes.status === 'fulfilled') {
      if (!photosRes.value.available && storagePhotos.length === 0) {
        nextPhotosStatus = 'unavailable';
      }
    } else if (storagePhotos.length === 0) {
      nextPhotosStatus = 'error';
    }

    const storagePhotoIds = new Set(storagePhotos.map((p) => p.id));
    const mergedPhotos = [
      ...storagePhotos,
      ...basePhotos.filter((p) => !storagePhotoIds.has(p.id)),
    ];
    setPhotos(mergedPhotos);

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

  const resolvedHistory = useMemo(
    () =>
      conditions
        .filter((c) => c.status === 'resolved')
        .slice()
        .sort((a, b) => {
          const ta = Date.parse(a.resolvedAt ?? a.updatedAt ?? a.recordedAt) || 0;
          const tb = Date.parse(b.resolvedAt ?? b.updatedAt ?? b.recordedAt) || 0;
          return tb - ta;
        }),
    [conditions]
  );

  const selectedResolvedRecord = useMemo(() => {
    if (!selectedMuscle) return null;
    return (
      resolvedHistory.find(
        (rec) => rec.muscleId.trim().toLowerCase() === selectedMuscle.id.toLowerCase()
      ) ?? null
    );
  }, [resolvedHistory, selectedMuscle]);

  const latestHealthCheck = useMemo(() => {
    if (healthChecks.length === 0) return null;
    return healthChecks
      .slice()
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0];
  }, [healthChecks]);

  const handleSelectMuscle = useCallback((muscleId: string | null) => {
    setSelectedMuscleId(muscleId);
  }, []);

  const handleSaveMuscleUpdate = useCallback(
    async (muscle: MuscleData, input: SaveMuscleUpdateInput) => {
      const isCured = Boolean(input.isCured || input.painIntensity <= 0);
      let uploadedPath: string | undefined;
      if (input.photoFile) {
        const uploaded = await uploadBodyConditionImageToBackend(muscle.id, input.photoFile);
        uploadedPath = uploaded.path;
      }

      const existingNotes = muscle.observation?.notes;
      const { serializedDescription } = appendConditionUpdate({
        existingDescription: muscle.observation ? existingNotes : undefined,
        newText: input.updateText,
        painIntensity: isCured ? 0 : input.painIntensity,
        photoPathOrFileName: uploadedPath,
        isResolvedEvent: isCured,
        fallbackPain: muscle.observation?.painIntensity,
        fallbackDateLabel: muscle.observation?.updatedAt,
      });

      const payload = {
        bodyRegion: muscle.category,
        muscleName: muscle.name,
        conditionName: muscle.observation?.conditionName || `Dolor en ${muscle.name}`,
        description: serializedDescription,
        painIntensity: isCured ? 1 : Math.max(1, Math.min(10, Math.round(input.painIntensity))),
        swelling: isCured ? false : input.swelling,
        functionalLimitation: isCured ? false : input.functionalLimitation,
      };

      if (isCured) {
        await cureBodyConditionWithHistoryInBackend(muscle.id, payload);
      } else {
        await saveBodyConditionToBackend(muscle.id, payload);
      }

      await performSync();
    },
    [performSync]
  );

  const handleCureMuscle = useCallback(
    async (muscle: MuscleData, closingNote?: string) => {
      await handleSaveMuscleUpdate(muscle, {
        updateText:
          closingNote?.trim() || 'Ya no siento el síntoma, molestia superada.',
        painIntensity: 0,
        swelling: false,
        functionalLimitation: false,
        isCured: true,
      });
    },
    [handleSaveMuscleUpdate]
  );

  const handleIntroComplete = useCallback(() => {
    setIntroFinished(true);
  }, []);

  return (
    <div className={`app-root theme-${themeMode}`}>
      <HexagonalVaultBackground themeMode={themeMode} />
      {!introFinished && <StartupSplashAnimation onComplete={handleIntroComplete} />}
      <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
        <AstronautProfileBar
          astronauts={astronauts}
          selectedAstronautId={selectedAstronautId}
          onSelectAstronaut={(id) => setSelectedAstronautId(id)}
          connectionStatus={connectionStatus}
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
              resolvedRecord={selectedResolvedRecord}
              onSelectMuscle={handleSelectMuscle}
              onSaveUpdate={handleSaveMuscleUpdate}
              onCureMuscle={handleCureMuscle}
            />

            <section className="panel-card compact-card-block" aria-label="Zonas con síntomas reportados">
              <div className="compact-card-header">
                <span className="compact-card-title">
                  {symptomsViewTab === 'active' ? 'Zonas con Síntomas' : 'Historial de Malestares'}
                </span>
                <div className="symptoms-tab-switch" role="tablist" aria-label="Filtrar zonas">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={symptomsViewTab === 'active'}
                    className={`symptoms-tab-btn ${symptomsViewTab === 'active' ? 'active' : ''}`}
                    onClick={() => setSymptomsViewTab('active')}
                  >
                    Activos ({activeLesions.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={symptomsViewTab === 'history'}
                    className={`symptoms-tab-btn ${symptomsViewTab === 'history' ? 'active' : ''}`}
                    onClick={() => setSymptomsViewTab('history')}
                  >
                    Historial ({resolvedHistory.length})
                  </button>
                </div>
              </div>

              {symptomsViewTab === 'active' ? (
                activeLesions.length === 0 ? (
                  <div className="compact-empty-row">
                    <CheckIcon size={14} />
                    <span>Sin molestias musculares activas.</span>
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
                )
              ) : resolvedHistory.length === 0 ? (
                <div className="compact-empty-row">
                  <CheckIcon size={14} />
                  <span>Sin malestares curados en el historial aún.</span>
                </div>
              ) : (
                <div className="active-records-list">
                  {resolvedHistory.map((rec) => {
                    const isSelected =
                      selectedMuscle?.id.toLowerCase() === rec.muscleId.trim().toLowerCase();
                    const recPhotos = photos.filter(
                      (p) => p.muscleId.trim().toLowerCase() === rec.muscleId.trim().toLowerCase()
                    );
                    const updates = parseConditionUpdates({
                      description: rec.description ?? '',
                      fallbackPain: rec.painIntensity,
                      fallbackDateLabel: formatShortUpdateDate(rec.resolvedAt ?? rec.updatedAt),
                      photos: recPhotos,
                    });
                    const curedDate = formatShortUpdateDate(rec.resolvedAt ?? rec.updatedAt);

                    return (
                      <button
                        key={rec.id || rec.muscleId}
                        type="button"
                        className={`active-record-row resolved-history-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectMuscle(rec.muscleId)}
                      >
                        <span className="record-icon-box resolved-icon-box">
                          <CheckIcon size={15} />
                        </span>
                        <div className="record-text-col">
                          <div className="record-title-row">
                            <strong>{rec.muscleName}</strong>
                            <span className="record-severity-pill resolved-pill">Curado</span>
                          </div>
                          <span className="record-subtext">
                            {updates.length} {updates.length === 1 ? 'actualización' : 'actualizaciones'} ·{' '}
                            {recPhotos.length} {recPhotos.length === 1 ? 'foto' : 'fotos'}
                            {curedDate ? ` · ${curedDate}` : ''}
                          </span>
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
    </div>
  );
}

export default App;
