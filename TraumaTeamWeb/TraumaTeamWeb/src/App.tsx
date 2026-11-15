import { HealthAlertsPanel } from './components/HealthAlertsPanel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AstronautProfileBar } from './components/AstronautProfileBar';
import { BodyModelViewerWeb } from './components/BodyModelViewerWeb';
import { BodyCompositionCards } from './components/BodyCompositionCards';
import { SideCarousel } from './components/SideCarousel';
import { useBodyComposition } from './hooks/use-body-composition';
import { HealthChartsPanel } from './components/HealthChartsPanel';
import { HexagonalVaultBackground } from './components/HexagonalVaultBackground';
import {
  ActivityIcon,
  CheckIcon,
  ChevronRightIcon,
  LayersIcon,
  RegionCategoryIcon,
  XIcon,
} from './components/Icons';

function getSeverityTag(intensity: number): string {
  if (intensity <= 3) return 'Mild';
  if (intensity <= 6) return 'Moderate';
  if (intensity <= 8) return 'Severe';
  return 'Critical';
}
import { MuscleDetailAndAiPanel } from './components/MuscleDetailAndAiPanel';
import { RealtimeEcgMonitor } from './components/RealtimeEcgMonitor';
import { StartupSplashAnimation } from './components/StartupSplashAnimation';
import { SymptomPulseCards } from './components/SymptomPulseCards';
import { useInjuryPhotos } from './hooks/use-injury-photos';
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
  fetchBodyConditionsFromBackend,
  fetchDailyHealthChecksFromBackend,
  fetchSamplesFromBackend,
  fetchAstronautLocationFromBackend,
  getInitialEmptyVitals,
  saveBodyConditionToBackend,
  uploadBodyConditionImageToBackend,
} from './services/backend-api';
import {
  appendConditionUpdate,
  formatShortUpdateDate,
  parseConditionUpdates,
} from './utils/condition-updates';
import { displayReportText, getGravityLabel } from './utils/display-labels.ts';
import type {
  AstronautProfile,
  BodyConditionRecord,
  ConnectionEndpointStatus,
  DailyHealthCheck,
  DashboardSample,
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
  const [astronauts, setAstronauts] = useState<AstronautProfile[]>([PRIMARY_ASTRONAUT]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>(PRIMARY_ASTRONAUT.id);
  const themeMode = 'light' as const;
  const [responsiveStage, setResponsiveStage] = useState<ResponsiveStage>('all');
  const [symptomsViewTab, setSymptomsViewTab] = useState<'active' | 'history'>('active');

  const [samples, setSamples] = useState<DashboardSample[]>([]);
  const [vitals, setVitals] = useState<VitalSignsData>(() => getInitialEmptyVitals());
  const [conditions, setConditions] = useState<BodyConditionRecord[]>([]);
  const [healthChecks, setHealthChecks] = useState<DailyHealthCheck[]>([]);

  const bodyComposition = useBodyComposition();
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [zoneSnapshots, setZoneSnapshots] = useState<Record<string, string>>({});
  const [zoneThumbnails, setZoneThumbnails] = useState<Record<string, string>>({});
  const handleZoneThumbnail = useCallback((zoneId: string, dataUrl: string) => {
    setZoneThumbnails((previous) => ({ ...previous, [zoneId]: dataUrl }));
  }, []);

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

    const [samplesRes, condRes, checksRes, locationRes] = await Promise.allSettled([
      fetchSamplesFromBackend(500),
      fetchBodyConditionsFromBackend(500),
      fetchDailyHealthChecksFromBackend(100),
      fetchAstronautLocationFromBackend(),
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
      setConditions(condRes.value);
    } else {
      nextCondStatus = 'error';
    }

    let nextChecksStatus: ConnectionEndpointStatus['healthChecksStatus'] = 'ok';
    if (checksRes.status === 'fulfilled') {
      setHealthChecks(checksRes.value);
    } else {
      nextChecksStatus = 'error';
    }

    if (locationRes.status === 'fulfilled' && locationRes.value) {
      const loc = locationRes.value;
      setAstronauts((prev) =>
        prev.map((astro) =>
          astro.id === selectedAstronautId || astro.isPrimary
            ? {
                ...astro,
                environment: loc.environment,
                gravityLabel: getGravityLabel(loc.gravityLabel),
              }
            : astro
        )
      );
    }

    setConnectionStatus({
      healthOk,
      samplesStatus: nextSamplesStatus,
      bodyConditionsStatus: nextCondStatus,
      healthChecksStatus: nextChecksStatus,
      photosStatus: 'idle',
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
          updatedAt: new Date(rec.updatedAt).toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          recordedAtIso: rec.recordedAt,
          updatedAtIso: rec.updatedAt,
        },
      };
    });
  }, [conditions]);

  const selectedMuscle = useMemo(
    () => (selectedMuscleId ? muscles.find((m) => m.id === selectedMuscleId) ?? null : null),
    [muscles, selectedMuscleId]
  );

  const musclePhotos = useInjuryPhotos(selectedMuscleId, selectedMuscle?.name);
  const reloadMusclePhotos = musclePhotos.reload;

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
        conditionName: muscle.observation?.conditionName || `Pain in ${muscle.name}`,
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
      reloadMusclePhotos();
    },
    [performSync, reloadMusclePhotos]
  );

  const handleCureMuscle = useCallback(
    async (muscle: MuscleData, closingNote?: string) => {
      await handleSaveMuscleUpdate(muscle, {
        updateText:
          closingNote?.trim() || 'I no longer feel the symptom; discomfort overcome.',
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
          connectionStatus={{ ...connectionStatus, photosStatus: musclePhotos.status }}
          notifications={<HealthAlertsPanel astronautName={selectedAstronaut.name} onViewMuscle={(id) => { setSelectedMuscleId(id); setResponsiveStage('musculo'); }} />}
        />

      <div className="dashboard-shell">
        <nav className="stage-switcher-bar" aria-label="Tablet or mobile views">
          <div className="stage-switcher-pills">
            {(
              [
                ['all', 'All'],
                ['signos', '1. Vitals'],
                ['visor', '2. 3D Viewer'],
                ['musculo', '3. Muscle & AI'],
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
              <span>View {selectedMuscle.name}</span>
              <ChevronRightIcon size={14} />
            </button>
          )}
        </nav>

        <main className={`stage-grid stage-mode-${responsiveStage}`}>
          {/* Column 1: vitals; becomes a Vitals / Body composition carousel while a muscle is selected */}
          <div
            className={`stage-col ${
              responsiveStage === 'all' || responsiveStage === 'signos' ? 'visible' : 'hidden-sm'
            }`}
          >
            <SideCarousel
              enabled={selectedMuscle !== null}
              ariaLabel="Vitals and body composition"
              slides={[
                {
                  id: 'vitals',
                  label: 'Vitals',
                  content: (
                    <>
                      <RealtimeEcgMonitor vitals={vitals} astronaut={selectedAstronaut} />
                      <SymptomPulseCards
                        latestCheck={latestHealthCheck}
                        vitals={vitals}
                      />
                      <HealthChartsPanel vitals={vitals} allSamples={samples} />
                    </>
                  ),
                },
                {
                  id: 'body-composition',
                  label: 'Body composition',
                  content: <BodyCompositionCards data={bodyComposition} />,
                },
              ]}
            />
          </div>

          {/* Body composition column (no muscle selected). Conditional siblings keep the viewer's position stable. */}
          {selectedMuscle === null && (
            <div
              className={`stage-col stage-col-bodycomp ${
                responsiveStage === 'all' || responsiveStage === 'signos' ? 'visible' : 'hidden-sm'
              }`}
            >
              <BodyCompositionCards data={bodyComposition} />
            </div>
          )}

          {/* Column 2: Muscle dropdown + vertically stretched 3D body */}
          <div
            className={`stage-col stage-col-viewer ${
              responsiveStage === 'all' || responsiveStage === 'visor' ? 'visible' : 'hidden-sm'
            }`}
          >
            <BodyModelViewerWeb
              muscles={muscles}
              selectedMuscleId={selectedMuscle?.id ?? null}
              onSelectMuscle={handleSelectMuscle}
              onZoneThumbnail={handleZoneThumbnail}
              onZoneSnapshot={(zoneId, dataUrl) =>
                setZoneSnapshots((prev) => ({ ...prev, [zoneId]: dataUrl }))
              }
            />
          </div>

          {/* Column 3: Zone symptoms + AI space + Photos (read-only) */}
          {(selectedMuscle !== null || responsiveStage === 'musculo') && (
          <div
            className={`stage-col stage-col-detail ${
              selectedMuscle === null ? 'stage-col-picker-only' : ''
            } ${
              responsiveStage === 'all' || responsiveStage === 'musculo' ? 'visible' : 'hidden-sm'
            }`}
          >
            {selectedMuscle && (
              <button
                type="button"
                className="muscle-detail-close"
                aria-label={`Close ${selectedMuscle.name} details`}
                onClick={() => handleSelectMuscle(null)}
              >
                <XIcon size={16} />
              </button>
            )}
            <MuscleDetailAndAiPanel
              muscle={selectedMuscle}
              latestHealthCheck={latestHealthCheck}
              environment={selectedAstronaut.environment}
              photos={musclePhotos.photos}
              photosStatus={musclePhotos.status}
              photosError={musclePhotos.error}
              onReloadPhotos={musclePhotos.reload}
              snapshotUri={selectedMuscle ? zoneSnapshots[selectedMuscle.id] || zoneThumbnails[selectedMuscle.id] : undefined}
              resolvedRecord={selectedResolvedRecord}
              onSaveUpdate={handleSaveMuscleUpdate}
              onCureMuscle={handleCureMuscle}
            />

            <section className="panel-card muscle-records-panel" aria-labelledby="muscle-records-title">
              <header className="muscle-records-heading">
                <h2 id="muscle-records-title">Muscle tracking</h2>
                <p>{selectedMuscle
                  ? 'Check another zone or review resolved reports.'
                  : 'Select a zone to see its symptoms, photos and progress.'}</p>
              </header>
              <div className="symptoms-tab-switch muscle-records-tabs" role="tablist" aria-label="Filter zones"
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'active' : event.key === 'End' ? 'history'
                    : symptomsViewTab === 'active' ? 'history' : 'active';
                  setSymptomsViewTab(next);
                  event.currentTarget.querySelector<HTMLButtonElement>(`#muscle-records-${next}-tab`)?.focus();
                }}
              >
                <button type="button" role="tab" id="muscle-records-active-tab"
                  aria-selected={symptomsViewTab === 'active'} aria-controls="muscle-records-content"
                  tabIndex={symptomsViewTab === 'active' ? 0 : -1}
                  className={`symptoms-tab-btn ${symptomsViewTab === 'active' ? 'active' : ''}`}
                  onClick={() => setSymptomsViewTab('active')}
                >Active <span>{activeLesions.length}</span></button>
                <button type="button" role="tab" id="muscle-records-history-tab"
                  aria-selected={symptomsViewTab === 'history'} aria-controls="muscle-records-content"
                  tabIndex={symptomsViewTab === 'history' ? 0 : -1}
                  className={`symptoms-tab-btn ${symptomsViewTab === 'history' ? 'active' : ''}`}
                  onClick={() => setSymptomsViewTab('history')}
                >History <span>{resolvedHistory.length}</span></button>
              </div>
              <div id="muscle-records-content" role="tabpanel"
                aria-labelledby={`muscle-records-${symptomsViewTab}-tab`} tabIndex={0}>

              {symptomsViewTab === 'active' ? (
                activeLesions.length === 0 ? (
                  <div className="compact-empty-row">
                    <CheckIcon size={14} />
                    <span>No active muscle discomfort.</span>
                  </div>
                ) : (
                  <div className="active-records-list">
                    {activeLesions.map((m) => {
                      const pain = m.observation?.painIntensity ?? 0;
                      const painColor = getPainColorHex(pain);
                      const sevLabel = getSeverityTag(pain);
                      const severityColor = pain >= 9 ? '#991b1b' : pain >= 7 ? '#b91c1c'
                        : pain >= 4 ? '#9a3412' : '#854d0e';
                      const isSelected = selectedMuscle?.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`active-record-row ${isSelected ? 'selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectMuscle(m.id)}
                        >
                          <span className="record-anatomy-preview" aria-hidden="true">
                            {zoneThumbnails[m.id] ? (
                              <img src={zoneThumbnails[m.id]} alt="" width={84} height={84} />
                            ) : <RegionCategoryIcon category={m.category} size={32} />}
                          </span>
                          <div className="record-text-col">
                            <strong>{m.name}</strong>
                            <span className="record-condition">{displayReportText(m.observation?.conditionName || 'Reported')}</span>
                            <div className="record-pain-summary">
                              <span className="record-severity-pill" style={{ color: severityColor,
                                backgroundColor: `${painColor}16`, borderColor: `${painColor}40` }}>
                                {sevLabel}
                              </span>
                              <span className="record-pain-value">Pain <b>{pain}/10</b></span>
                            </div>
                            {(m.observation?.swelling || m.observation?.functionalLimitation) && (
                              <div className="record-mini-flags">
                                {m.observation?.swelling && (
                                  <span className="record-mini-flag">
                                    <LayersIcon size={10} /> Swelling
                                  </span>
                                )}
                                {m.observation?.functionalLimitation && (
                                  <span className="record-mini-flag">
                                    <ActivityIcon size={10} /> Limitation
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <ChevronRightIcon size={14} className="record-open-icon" />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : resolvedHistory.length === 0 ? (
                <div className="compact-empty-row">
                  <CheckIcon size={14} />
                  <span>No healed discomfort in the history yet.</span>
                </div>
              ) : (
                <div className="active-records-list">
                  {resolvedHistory.map((rec) => {
                    const isSelected =
                      selectedMuscle?.id.toLowerCase() === rec.muscleId.trim().toLowerCase();
                    const recPhotos = musclePhotos.photos.filter(
                      (p) => p.muscleId.trim().toLowerCase() === rec.muscleId.trim().toLowerCase()
                    );
                    const updates = parseConditionUpdates({
                      description: rec.description ?? '',
                      fallbackPain: rec.painIntensity,
                      fallbackDateLabel: formatShortUpdateDate(rec.resolvedAt ?? rec.updatedAt),
                      photos: recPhotos,
                    });
                    const curedDate = formatShortUpdateDate(rec.resolvedAt ?? rec.updatedAt);
                    const recordMuscle = muscles.find((m) => m.id.toLowerCase() === rec.muscleId.trim().toLowerCase());
                    const thumbnail = zoneThumbnails[recordMuscle?.id ?? rec.muscleId];

                    return (
                      <button
                        key={rec.id || rec.muscleId}
                        type="button"
                        className={`active-record-row resolved-history-row ${isSelected ? 'selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => handleSelectMuscle(rec.muscleId)}
                      >
                        <span className="record-anatomy-preview" aria-hidden="true">
                          {thumbnail ? <img src={thumbnail} alt="" width={84} height={84} />
                            : recordMuscle ? <RegionCategoryIcon category={recordMuscle.category} size={32} />
                            : <CheckIcon size={32} />}
                        </span>
                        <div className="record-text-col">
                          <div className="record-title-row">
                            <strong>{recordMuscle?.name ?? rec.muscleName}</strong>
                            <span className="record-severity-pill resolved-pill">Healed</span>
                          </div>
                          <span className="record-condition">{displayReportText(rec.conditionName || 'Resolved report')}</span>
                          <span className="record-subtext">
                            {updates.length} {updates.length === 1 ? 'update' : 'updates'}
                            {isSelected && musclePhotos.status === 'ok' && (
                              <> · {recPhotos.length} {recPhotos.length === 1 ? 'photo' : 'photos'}</>
                            )}
                            {curedDate ? ` · ${curedDate}` : ''}
                          </span>
                        </div>
                        <ChevronRightIcon size={14} className="record-open-icon" />
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
            </section>
          </div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}

export default App;
