import React, { useMemo, useState } from 'react';
import brandLogo from '../assets/Recurso 6.svg';
import {
  getMuscleKnowledge,
  getPainColorHex,
  getRiskTierFromIntensity,
  getRiskTierMeta,
} from '../data/anatomy-catalog';
import type { DailyHealthCheck, InjuryPhoto, MuscleData } from '../types/dashboard';
import { InjuryPhotosDossier } from './InjuryPhotosDossier';
import {
  ActivityIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  LayersIcon,
  OrbitIcon,
  RegionCategoryIcon,
  SparklesIcon,
  StethoscopeIcon,
} from './Icons';

function getPainSeverityLabel(intensity: number): string {
  if (intensity <= 3) return 'Leve';
  if (intensity <= 6) return 'Moderado';
  if (intensity <= 8) return 'Severo';
  return 'Crítico';
}

interface MuscleDetailAndAiPanelProps {
  muscle: MuscleData | null;
  allMuscles: MuscleData[];
  latestHealthCheck: DailyHealthCheck | null;
  photos: InjuryPhoto[];
  snapshotUri?: string;
  onSelectMuscle: (muscleId: string) => void;
}

export const MuscleDetailAndAiPanel: React.FC<MuscleDetailAndAiPanelProps> = ({
  muscle,
  allMuscles,
  latestHealthCheck,
  photos,
  snapshotUri,
  onSelectMuscle,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'photos'>('overview');

  const knowledge = useMemo(() => {
    if (!muscle) return null;
    return getMuscleKnowledge(muscle);
  }, [muscle]);

  const musclePhotos = useMemo(() => {
    if (!muscle) return [];
    return photos.filter((p) => p.muscleId === muscle.id);
  }, [muscle, photos]);

  const generalSymptoms = useMemo(() => {
    if (!latestHealthCheck || latestHealthCheck.symptoms.length === 0) return [];
    return latestHealthCheck.symptoms.filter((s) => s.toLowerCase() !== 'ninguno');
  }, [latestHealthCheck]);

  const affectedMuscles = useMemo(
    () =>
      allMuscles
        .filter((m) => m.status !== 'normal' && Boolean(m.observation))
        .sort(
          (a, b) => (b.observation?.painIntensity ?? 0) - (a.observation?.painIntensity ?? 0)
        ),
    [allMuscles]
  );

  if (!muscle || !knowledge) {
    return (
      <section className="panel-card muscle-panel-card" aria-label="Sin zona muscular seleccionada">
        <div className="muscle-empty-card">
          <div className="muscle-empty-cosmic">
            <svg
              className="muscle-hero-stars"
              viewBox="0 0 360 110"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <circle cx="34" cy="22" r="1" fill="#93c5fd" opacity="0.65" />
              <circle cx="96" cy="78" r="1.1" fill="#e2e8f0" opacity="0.5" />
              <circle cx="152" cy="18" r="1.2" fill="#38bdf8" opacity="0.7" />
              <circle cx="242" cy="84" r="1" fill="#e2e8f0" opacity="0.45" />
              <circle cx="312" cy="26" r="1.3" fill="#7dd3fc" opacity="0.75" />
              <path
                d="M14 90 Q 175 18 346 72"
                fill="none"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="1.2"
                strokeDasharray="3 4"
              />
            </svg>
            <div className="muscle-empty-emblem">
              <img src={brandLogo} alt="TraumaTeam" className="muscle-empty-emblem-img" />
              <span className="muscle-empty-emblem-ring" aria-hidden="true" />
            </div>
            <div className="muscle-empty-cosmic-copy">
              <span className="muscle-empty-eyebrow">ESCÁNER ANATÓMICO · EN ESPERA</span>
              <strong>Selecciona una región 3D</strong>
              <p>
                Toca un punto anatómico en el modelo 3D, usa el selector superior o elige un
                registro activo para consultar síntomas e informes.
              </p>
            </div>
          </div>

          {affectedMuscles.length > 0 ? (
            <div className="muscle-empty-actions">
              <div className="muscle-empty-actions-head">
                <span>Reportes activos en curso</span>
                <span className="muscle-empty-count">{affectedMuscles.length}</span>
              </div>
              <div className="muscle-empty-records">
                {affectedMuscles.map((m) => {
                  const pain = m.observation?.painIntensity ?? 0;
                  const painColor = getPainColorHex(pain);
                  const sevLabel = getPainSeverityLabel(pain);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="muscle-empty-record-btn"
                      onClick={() => onSelectMuscle(m.id)}
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
                      <div className="muscle-empty-record-copy">
                        <strong>{m.name}</strong>
                        <span>
                          {m.category} · {m.observation?.conditionName || 'Con reporte'}
                        </span>
                      </div>
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
                      <ChevronRightIcon size={14} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="muscle-empty-clear-pill">
              <CheckIcon size={14} />
              <span>Sin zonas musculares con síntomas activos</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  const obs = muscle.observation;
  const hasReport = muscle.status !== 'normal' && Boolean(obs);
  const tier = getRiskTierFromIntensity(obs?.painIntensity ?? 0);
  const tierMeta = getRiskTierMeta(tier);

  return (
    <section className="panel-card muscle-panel-card" aria-label={`Ficha de ${muscle.name}`}>
      <div
        className="muscle-hero-dark"
        style={
          {
            borderColor: hasReport ? `${tierMeta.color}99` : 'rgba(56, 189, 248, 0.32)',
            '--hero-glow': hasReport ? `${tierMeta.color}36` : 'rgba(56, 189, 248, 0.22)',
          } as React.CSSProperties
        }
      >
        <svg
          className="muscle-hero-stars"
          viewBox="0 0 360 96"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <circle cx="48" cy="18" r="1" fill="#93c5fd" opacity="0.55" />
          <circle cx="136" cy="72" r="0.9" fill="#e2e8f0" opacity="0.45" />
          <circle cx="222" cy="20" r="1.1" fill="#38bdf8" opacity="0.65" />
          <circle cx="294" cy="64" r="1" fill="#e2e8f0" opacity="0.45" />
          <circle cx="332" cy="24" r="1.2" fill="#7dd3fc" opacity="0.6" />
        </svg>

        <div className="muscle-hero-left">
          <div
            className="muscle-snapshot-box"
            style={{
              borderColor: hasReport ? tierMeta.color : '#38bdf8',
              boxShadow: `0 0 16px ${hasReport ? `${tierMeta.color}40` : 'rgba(56, 189, 248, 0.28)'}`,
            }}
          >
            {snapshotUri ? (
              <>
                <img src={snapshotUri} alt={muscle.name} className="muscle-snapshot-img" />
                <span
                  className="muscle-snapshot-cat-badge"
                  style={{ color: hasReport ? tierMeta.color : '#58c7f3' }}
                >
                  <RegionCategoryIcon category={muscle.category} size={12} />
                </span>
              </>
            ) : (
              <RegionCategoryIcon category={muscle.category} size={24} />
            )}
          </div>

          <div className="muscle-hero-meta">
            <span className="muscle-hero-eyebrow">ZONA SELECCIONADA</span>
            <h2 className="muscle-hero-title">{muscle.name}</h2>
            <span className="muscle-hero-cat-row">
              <RegionCategoryIcon category={muscle.category} size={11} />
              <span>{muscle.category}</span>
            </span>
          </div>
        </div>

        <span
          className="muscle-hero-badge"
          style={{
            backgroundColor: hasReport ? `${tierMeta.color}28` : 'rgba(88, 199, 243, 0.16)',
            color: hasReport ? '#ffffff' : '#58c7f3',
            borderColor: hasReport ? tierMeta.color : 'rgba(88, 199, 243, 0.45)',
          }}
        >
          <span
            className="hero-status-dot"
            style={{ backgroundColor: hasReport ? tierMeta.color : '#38bdf8' }}
          />
          {hasReport ? 'Con síntomas' : 'Sin reporte'}
        </span>
      </div>

      <div className="panel-tab-pills panel-tab-pills-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`panel-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <StethoscopeIcon size={13} />
          <span>Síntomas e IA</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'photos'}
          className={`panel-tab-btn ${activeTab === 'photos' ? 'active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <CameraIcon size={13} />
          <span>Fotos ({musclePhotos.length || photos.length})</span>
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div key={muscle.id} className="muscle-detail-stage">
          <div className="muscle-readonly-stack">
            {/* Bloque 1: Qué síntomas siente en esta zona */}
            <div
              className={`symptom-report-box ${hasReport ? 'has-report' : ''}`}
              style={
                {
                  '--srb-accent':
                    hasReport && obs ? getPainColorHex(obs.painIntensity) : '#10b981',
                } as React.CSSProperties
              }
            >
              <div className="srb-accent-bar" aria-hidden="true" />
              <div className="srb-head">
                <div className="srb-title">
                  <span
                    className="srb-title-icon"
                    style={{
                      color: hasReport && obs ? getPainColorHex(obs.painIntensity) : '#10b981',
                      backgroundColor:
                        hasReport && obs
                          ? `${getPainColorHex(obs.painIntensity)}18`
                          : 'rgba(16, 185, 129, 0.14)',
                    }}
                  >
                    {hasReport ? <AlertTriangleIcon size={13} /> : <CheckIcon size={13} />}
                  </span>
                  <span>Síntomas reportados</span>
                </div>
                {obs?.updatedAt && <span className="srb-date">{obs.updatedAt}</span>}
              </div>

              {hasReport && obs ? (
                <div className="srb-content">
                  <div className="srb-condition-row">
                    <strong className="srb-condition">{obs.conditionName}</strong>
                    <span
                      className="srb-severity-pill"
                      style={{
                        color: getPainColorHex(obs.painIntensity),
                        backgroundColor: `${getPainColorHex(obs.painIntensity)}16`,
                        borderColor: `${getPainColorHex(obs.painIntensity)}45`,
                      }}
                    >
                      <span
                        className="srb-severity-dot"
                        style={{ backgroundColor: getPainColorHex(obs.painIntensity) }}
                      />
                      {getPainSeverityLabel(obs.painIntensity)}
                    </span>
                  </div>

                  <div className="srb-metrics-grid">
                    <div className={`srb-metric-card ${obs.swelling ? 'is-alert' : 'is-ok'}`}>
                      <div className="srb-metric-head">
                        <LayersIcon size={12} />
                        <span>Hinchazón (Edema)</span>
                      </div>
                      <strong className="srb-metric-value">
                        {obs.swelling ? 'Detectado · Sí' : 'Normal · No'}
                      </strong>
                    </div>

                    <div
                      className={`srb-metric-card ${obs.functionalLimitation ? 'is-alert' : 'is-ok'}`}
                    >
                      <div className="srb-metric-head">
                        <ActivityIcon size={12} />
                        <span>Limitación funcional</span>
                      </div>
                      <strong className="srb-metric-value">
                        {obs.functionalLimitation ? 'Presente · Sí' : 'Normal · No'}
                      </strong>
                    </div>
                  </div>

                  {obs.notes && (
                    <div className="srb-note-box">
                      <span className="srb-note-icon">
                        <FileTextIcon size={13} />
                      </span>
                      <div className="srb-note-copy">
                        <span className="srb-note-label">Detalles clínicos</span>
                        <p className="srb-note">“{obs.notes}”</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="srb-empty">
                  No hay molestias ni síntomas musculares reportados en {muscle.name}.
                </p>
              )}

              {generalSymptoms.length > 0 && (
                <div className="srb-general-symptoms">
                  <span className="srb-sublabel">Síntomas generales recientes:</span>
                  <div className="sym-chips-strip">
                    {generalSymptoms.map((sym) => (
                      <span key={sym} className="sym-reported-chip">
                        ● {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bloque 2: Espacio reservado para propuestas de IA (sin implementar/simular aún) */}
            <div className="ai-slot-card" aria-label="Espacio reservado para recomendación IA">
              <svg
                className="ai-copilot-wave"
                viewBox="0 0 360 44"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0 28 C 48 8, 92 40, 148 22 C 196 6, 248 36, 304 18 C 328 10, 346 22, 360 16"
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.32)"
                  strokeWidth="1.5"
                />
                <path
                  d="M0 34 C 60 18, 114 42, 176 26 C 228 12, 278 38, 360 24"
                  fill="none"
                  stroke="rgba(125, 211, 252, 0.16)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </svg>

              <div className="ai-slot-head">
                <div className="ai-slot-title">
                  <span className="ai-slot-icon-orb">
                    <SparklesIcon size={13} />
                  </span>
                  <div className="ai-slot-heading-copy">
                    <span className="ai-slot-kicker">COPILOTO CLÍNICO</span>
                    <strong>Propuesta Clínica IA</strong>
                  </div>
                </div>
                <span className="ai-slot-badge">Espacio reservado</span>
              </div>

              <div className="ai-context-chips">
                <span className="ai-context-chip">Zona: {muscle.name}</span>
                {hasReport && obs ? (
                  <>
                    <span className="ai-context-chip">{obs.conditionName}</span>
                    {obs.swelling && <span className="ai-context-chip warn">Edema</span>}
                    {obs.functionalLimitation && (
                      <span className="ai-context-chip warn">Limitación</span>
                    )}
                  </>
                ) : (
                  <span className="ai-context-chip muted">Sin síntomas activos</span>
                )}
              </div>

              <div className="ai-slot-body">
                <p>
                  Pendiente de conexión con el módulo IA / RAG. Aquí se mostrarán las sugerencias
                  para {muscle.name} a partir de los síntomas recibidos.
                </p>
              </div>
            </div>

            {/* Bloque 3: Explicación anatómica compacta del músculo */}
            <div className="anatomy-compact-card">
              <div className="anatomy-dual-grid">
                <div className="anatomy-info-tile">
                  <div className="anatomy-tile-head">
                    <span className="anatomy-tile-icon">
                      <BookOpenIcon size={12} />
                    </span>
                    <span className="anatomy-tag">Anatomía</span>
                  </div>
                  <p>{knowledge.anatomicalSummary}</p>
                </div>

                <div className="anatomy-info-tile spaceflight">
                  <div className="anatomy-tile-head">
                    <span className="anatomy-tile-icon orbit">
                      <OrbitIcon size={12} />
                    </span>
                    <span className="anatomy-tag">En 0g</span>
                  </div>
                  <p>{knowledge.spaceflightImpact}</p>
                </div>
              </div>

              <div className="structures-section">
                <span className="structures-label">Estructuras clave</span>
                <div className="structures-pill-row">
                  {knowledge.keyStructures.map((st) => (
                    <span key={st} className="structure-pill">
                      <span className="structure-dot" aria-hidden="true" />
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <InjuryPhotosDossier
          key={muscle.id}
          photos={photos}
          muscles={allMuscles}
          selectedMuscleId={muscle.id}
          onSelectMuscle={onSelectMuscle}
        />
      )}
    </section>
  );
};
