import React, { useMemo, useState } from 'react';
import brandLogo from '../assets/Recurso 6.svg';
import {
  getMuscleKnowledge,
  getPainColorHex,
  getRiskTierFromIntensity,
  getRiskTierMeta,
} from '../data/anatomy-catalog';
import type { SaveMuscleUpdateInput } from '../App';
import type {
  BodyConditionRecord,
  DailyHealthCheck,
  InjuryPhoto,
  MuscleData,
  MuscleMedicalKnowledge,
} from '../types/dashboard';
import { formatShortUpdateDate, parseConditionUpdates } from '../utils/condition-updates';
import { InjuryPhotosDossier } from './InjuryPhotosDossier';
import {
  ActivityIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  LayersIcon,
  OrbitIcon,
  RegionCategoryIcon,
  SparklesIcon,
  StethoscopeIcon,
} from './Icons';

function getPainSeverityLabel(intensity: number): string {
  if (intensity <= 0) return 'Curado';
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
  resolvedRecord?: BodyConditionRecord | null;
  onSelectMuscle: (muscleId: string) => void;
  onSaveUpdate?: (muscle: MuscleData, input: SaveMuscleUpdateInput) => Promise<void>;
  onCureMuscle?: (muscle: MuscleData, closingNote?: string) => Promise<void>;
}

interface SelectedMuscleContentProps {
  muscle: MuscleData;
  allMuscles: MuscleData[];
  knowledge: MuscleMedicalKnowledge;
  generalSymptoms: string[];
  photos: InjuryPhoto[];
  musclePhotos: InjuryPhoto[];
  snapshotUri?: string;
  resolvedRecord?: BodyConditionRecord | null;
  onSelectMuscle: (muscleId: string) => void;
  onSaveUpdate?: (muscle: MuscleData, input: SaveMuscleUpdateInput) => Promise<void>;
  onCureMuscle?: (muscle: MuscleData, closingNote?: string) => Promise<void>;
}

const SelectedMuscleContent: React.FC<SelectedMuscleContentProps> = ({
  muscle,
  allMuscles,
  knowledge,
  generalSymptoms,
  photos,
  musclePhotos,
  snapshotUri,
  resolvedRecord,
  onSelectMuscle,
  onSaveUpdate,
  onCureMuscle,
}) => {
  const obs = muscle.observation;
  const hasReport = muscle.status !== 'normal' && Boolean(obs);
  const isResolvedHistory = !hasReport && Boolean(resolvedRecord);

  const [activeTab, setActiveTab] = useState<'overview' | 'photos'>('overview');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmCureOpen, setConfirmCureOpen] = useState(false);
  const [painIntensity, setPainIntensity] = useState<number>(obs?.painIntensity ?? 6);
  const [swelling, setSwelling] = useState<boolean>(obs?.swelling ?? false);
  const [functionalLimitation, setFunctionalLimitation] = useState<boolean>(
    obs?.functionalLimitation ?? false
  );
  const [updateText, setUpdateText] = useState('');
  const [closingCureNote, setClosingCureNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const parsedUpdates = useMemo(() => {
    if (hasReport && obs) {
      return parseConditionUpdates({
        description: obs.notes,
        fallbackPain: obs.painIntensity,
        fallbackDateLabel: obs.updatedAt,
        photos: musclePhotos,
      });
    }
    if (isResolvedHistory && resolvedRecord) {
      return parseConditionUpdates({
        description: resolvedRecord.description ?? '',
        fallbackPain: resolvedRecord.painIntensity,
        fallbackDateLabel: formatShortUpdateDate(
          resolvedRecord.resolvedAt ?? resolvedRecord.updatedAt
        ),
        photos: musclePhotos,
      });
    }
    return [];
  }, [hasReport, obs, isResolvedHistory, resolvedRecord, musclePhotos]);

  const nextUpdateNumber = hasReport
    ? parsedUpdates.length > 0
      ? Math.max(...parsedUpdates.map((u) => u.updateNumber)) + 1
      : 2
    : 1;

  const tier = getRiskTierFromIntensity(obs?.painIntensity ?? 0);
  const tierMeta = getRiskTierMeta(tier);
  const heroColor = hasReport ? tierMeta.color : isResolvedHistory ? '#10b981' : '#38bdf8';

  const displaySwelling = hasReport ? Boolean(obs?.swelling) : Boolean(resolvedRecord?.swelling);
  const displayLimitation = hasReport
    ? Boolean(obs?.functionalLimitation)
    : Boolean(resolvedRecord?.functionalLimitation);

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveUpdate || isSubmitting) return;
    setActionError(null);
    setIsSubmitting(true);

    const isCured = painIntensity <= 0;
    const cleanedNote =
      updateText.trim() ||
      (isCured
        ? 'Ya no siento el síntoma, molestia superada.'
        : hasReport
          ? `Seguimiento #${nextUpdateNumber} en ${muscle.name}.`
          : `Registro inicial en ${muscle.name}.`);

    try {
      await onSaveUpdate(muscle, {
        updateText: cleanedNote,
        painIntensity,
        swelling: isCured ? false : swelling,
        functionalLimitation: isCured ? false : functionalLimitation,
        photoFile,
        isCured,
      });
      setIsFormOpen(false);
      setUpdateText('');
      setPhotoFile(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo guardar la actualización.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCure = async () => {
    if (!onCureMuscle || isSubmitting) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await onCureMuscle(muscle, closingCureNote.trim() || undefined);
      setConfirmCureOpen(false);
      setClosingCureNote('');
      setIsFormOpen(false);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo marcar como curado.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel-card muscle-panel-card" aria-label={`Ficha de ${muscle.name}`}>
      <div
        className="muscle-hero-dark"
        style={
          {
            borderColor:
              hasReport || isResolvedHistory ? `${heroColor}99` : 'rgba(56, 189, 248, 0.32)',
            '--hero-glow':
              hasReport || isResolvedHistory ? `${heroColor}36` : 'rgba(56, 189, 248, 0.22)',
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
              borderColor: heroColor,
              boxShadow: `0 0 16px ${heroColor}40`,
            }}
          >
            {snapshotUri ? (
              <>
                <img src={snapshotUri} alt={muscle.name} className="muscle-snapshot-img" />
                <span
                  className="muscle-snapshot-cat-badge"
                  style={{ color: heroColor }}
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
            backgroundColor: hasReport
              ? `${tierMeta.color}28`
              : isResolvedHistory
                ? 'rgba(16, 185, 129, 0.22)'
                : 'rgba(88, 199, 243, 0.16)',
            color: hasReport ? '#ffffff' : isResolvedHistory ? '#a7f3d0' : '#58c7f3',
            borderColor: hasReport
              ? tierMeta.color
              : isResolvedHistory
                ? '#10b981'
                : 'rgba(88, 199, 243, 0.45)',
          }}
        >
          <span
            className="hero-status-dot"
            style={{ backgroundColor: heroColor }}
          />
          {hasReport
            ? `Activo · ${obs?.painIntensity}/10`
            : isResolvedHistory
              ? 'Curado · Historial'
              : 'Sin reporte'}
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
            {/* Bloque 1: Síntomas, Actualizaciones 1..N y Curación */}
            <div
              className={`symptom-report-box ${hasReport || isResolvedHistory ? 'has-report' : ''}`}
              style={
                {
                  '--srb-accent':
                    hasReport && obs
                      ? getPainColorHex(obs.painIntensity)
                      : isResolvedHistory
                        ? '#10b981'
                        : '#93DEFF',
                } as React.CSSProperties
              }
            >
              <div className="srb-accent-bar" aria-hidden="true" />
              <div className="srb-head">
                <div className="srb-title">
                  <span
                    className="srb-title-icon"
                    style={{
                      color: hasReport && obs
                        ? getPainColorHex(obs.painIntensity)
                        : isResolvedHistory
                          ? '#047857'
                          : '#0369a1',
                      backgroundColor:
                        hasReport && obs
                          ? `${getPainColorHex(obs.painIntensity)}18`
                          : isResolvedHistory
                            ? 'rgba(16, 185, 129, 0.16)'
                            : 'rgba(147, 222, 255, 0.3)',
                    }}
                  >
                    {hasReport ? <AlertTriangleIcon size={13} /> : <CheckIcon size={13} />}
                  </span>
                  <span>
                    {isResolvedHistory
                      ? 'Historial de malestar curado'
                      : 'Síntomas y actualizaciones'}
                  </span>
                </div>
                {hasReport && obs?.updatedAt ? (
                  <span className="srb-date">{obs.updatedAt}</span>
                ) : isResolvedHistory && resolvedRecord ? (
                  <span className="srb-date">
                    Curado {formatShortUpdateDate(resolvedRecord.resolvedAt ?? resolvedRecord.updatedAt)}
                  </span>
                ) : null}
              </div>

              {(hasReport && obs) || (isResolvedHistory && resolvedRecord) ? (
                <div className="srb-content">
                  <div className="srb-condition-row">
                    <strong className="srb-condition">
                      {hasReport ? obs?.conditionName : resolvedRecord?.conditionName}
                    </strong>
                    <span
                      className="srb-severity-pill"
                      style={
                        hasReport && obs
                          ? {
                              color: getPainColorHex(obs.painIntensity),
                              backgroundColor: `${getPainColorHex(obs.painIntensity)}16`,
                              borderColor: `${getPainColorHex(obs.painIntensity)}45`,
                            }
                          : {
                              color: '#047857',
                              backgroundColor: 'rgba(16, 185, 129, 0.14)',
                              borderColor: 'rgba(16, 185, 129, 0.45)',
                            }
                      }
                    >
                      <span
                        className="srb-severity-dot"
                        style={{
                          backgroundColor:
                            hasReport && obs ? getPainColorHex(obs.painIntensity) : '#10b981',
                        }}
                      />
                      {hasReport && obs
                        ? `${getPainSeverityLabel(obs.painIntensity)} · ${obs.painIntensity}/10`
                        : 'Curado · 0/10'}
                    </span>
                  </div>

                  <div className="srb-metrics-grid">
                    <div className={`srb-metric-card ${displaySwelling ? 'is-alert' : 'is-ok'}`}>
                      <div className="srb-metric-head">
                        <LayersIcon size={12} />
                        <span>Hinchazón (Edema)</span>
                      </div>
                      <strong className="srb-metric-value">
                        {displaySwelling ? 'Detectado · Sí' : 'Normal · No'}
                      </strong>
                    </div>

                    <div className={`srb-metric-card ${displayLimitation ? 'is-alert' : 'is-ok'}`}>
                      <div className="srb-metric-head">
                        <ActivityIcon size={12} />
                        <span>Limitación funcional</span>
                      </div>
                      <strong className="srb-metric-value">
                        {displayLimitation ? 'Presente · Sí' : 'Normal · No'}
                      </strong>
                    </div>
                  </div>

                  {/* Línea temporal de Actualización 1, Actualización 2, ... */}
                  <div className="updates-timeline-block">
                    <div className="updates-timeline-header">
                      <span>Bitácora de actualizaciones ({parsedUpdates.length})</span>
                    </div>

                    {parsedUpdates.length === 0 ? (
                      <p className="srb-empty">Sin notas escritas registradas.</p>
                    ) : (
                      <div className="updates-timeline-list">
                        {parsedUpdates.map((item) => {
                          const itemColor =
                            item.isResolvedEvent || item.painIntensity === 0
                              ? '#059669'
                              : item.painIntensity
                                ? getPainColorHex(item.painIntensity)
                                : '#64748b';
                          return (
                            <div
                              key={`${item.updateNumber}-${item.dateLabel}`}
                              className={`update-timeline-card ${item.isResolvedEvent ? 'is-cured' : ''}`}
                            >
                              <div className="update-timeline-top">
                                <div className="update-timeline-title-wrap">
                                  <strong className="update-timeline-title">{item.title}</strong>
                                  {item.dateLabel && (
                                    <span className="update-timeline-date">{item.dateLabel}</span>
                                  )}
                                </div>
                                {(item.isResolvedEvent || item.painIntensity !== undefined) && (
                                  <span
                                    className="update-pain-chip"
                                    style={{
                                      color: itemColor,
                                      borderColor: `${itemColor}55`,
                                      backgroundColor: `${itemColor}14`,
                                    }}
                                  >
                                    {item.isResolvedEvent || item.painIntensity === 0
                                      ? 'Curado · 0/10'
                                      : `${item.painIntensity}/10`}
                                  </span>
                                )}
                              </div>

                              <p className="update-timeline-text">{item.text}</p>

                              {item.photoUri && (
                                <button
                                  type="button"
                                  className="update-photo-preview-btn"
                                  onClick={() => setActiveTab('photos')}
                                >
                                  <img
                                    src={item.photoUri}
                                    alt={`Evidencia de ${item.title}`}
                                    className="update-photo-thumb"
                                  />
                                  <div className="update-photo-meta">
                                    <strong>Foto de {item.title}</strong>
                                    <span>Abrir en visor / timelapse</span>
                                  </div>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="srb-empty">
                  No hay molestias ni síntomas musculares activos reportados en {muscle.name}.
                </p>
              )}

              {/* Controles de actualización y curación */}
              {(onSaveUpdate || onCureMuscle) && (
                <div className="condition-actions-wrap">
                  <div className="condition-actions-row">
                    {onSaveUpdate && (
                      <button
                        type="button"
                        className="condition-action-btn primary"
                        onClick={() => {
                          setActionError(null);
                          setConfirmCureOpen(false);
                          setPainIntensity(obs?.painIntensity ?? 6);
                          setSwelling(obs?.swelling ?? false);
                          setFunctionalLimitation(obs?.functionalLimitation ?? false);
                          setIsFormOpen((prev) => !prev);
                        }}
                      >
                        {isFormOpen
                          ? 'Cerrar formulario'
                          : hasReport
                            ? `+ Agregar actualización #${nextUpdateNumber}`
                            : '+ Registrar problema (Actualización 1)'}
                      </button>
                    )}

                    {hasReport && onCureMuscle && (
                      <button
                        type="button"
                        className="condition-action-btn cure"
                        onClick={() => {
                          setActionError(null);
                          setIsFormOpen(false);
                          setConfirmCureOpen((prev) => !prev);
                        }}
                      >
                        <CheckIcon size={13} />
                        <span>Ya no siento el síntoma</span>
                      </button>
                    )}
                  </div>

                  {confirmCureOpen && (
                    <div className="cure-confirm-box">
                      <strong>Marcar {muscle.name} como curado</strong>
                      <p>
                        Se moverá al Historial de malestares conservando todas las actualizaciones y
                        fotos.
                      </p>
                      <input
                        type="text"
                        className="update-input-control"
                        placeholder="Nota de cierre opcional (ej. Sin dolor al estirar)"
                        value={closingCureNote}
                        onChange={(e) => setClosingCureNote(e.target.value)}
                        maxLength={320}
                      />
                      {actionError && <p className="update-error-msg">{actionError}</p>}
                      <div className="cure-confirm-actions">
                        <button
                          type="button"
                          className="update-btn-secondary"
                          onClick={() => setConfirmCureOpen(false)}
                          disabled={isSubmitting}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="update-btn-cure-confirm"
                          onClick={() => void handleConfirmCure()}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Guardando...' : 'Confirmar curación'}
                        </button>
                      </div>
                    </div>
                  )}

                  {isFormOpen && (
                    <form className="update-entry-form" onSubmit={(e) => void handleSubmitUpdate(e)}>
                      <div className="update-form-head">
                        <strong>
                          {hasReport
                            ? `Nueva Actualización #${nextUpdateNumber}`
                            : 'Registrar Actualización 1'}
                        </strong>
                        <span
                          className={`update-pain-readout ${painIntensity === 0 ? 'is-cured' : ''}`}
                        >
                          {painIntensity === 0 ? '0/10 · Curado' : `${painIntensity}/10`}
                        </span>
                      </div>

                      <label className="update-field-label">
                        <span>Nivel de molestia actual (0 = ya no siento el síntoma)</span>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={painIntensity}
                          onChange={(e) => setPainIntensity(Number(e.target.value))}
                          className="update-range-input"
                        />
                      </label>

                      {painIntensity === 0 && (
                        <div className="update-cured-hint">
                          Al guardar con 0/10, la zona se curará y quedará en el Historial de
                          malestares.
                        </div>
                      )}

                      {painIntensity > 0 && (
                        <div className="update-toggles-row">
                          <label className="update-checkbox-pill">
                            <input
                              type="checkbox"
                              checked={swelling}
                              onChange={(e) => setSwelling(e.target.checked)}
                            />
                            <span>Hinchazón</span>
                          </label>
                          <label className="update-checkbox-pill">
                            <input
                              type="checkbox"
                              checked={functionalLimitation}
                              onChange={(e) => setFunctionalLimitation(e.target.checked)}
                            />
                            <span>Limitación funcional</span>
                          </label>
                        </div>
                      )}

                      <label className="update-field-label">
                        <span>Descripción de Actualización #{nextUpdateNumber}</span>
                        <textarea
                          rows={3}
                          className="update-textarea-control"
                          placeholder={
                            painIntensity === 0
                              ? 'Ej. Desapareció la molestia por completo.'
                              : `Describe evolución de Actualización #${nextUpdateNumber}...`
                          }
                          value={updateText}
                          onChange={(e) => setUpdateText(e.target.value)}
                          maxLength={400}
                        />
                      </label>

                      <div className="update-file-row">
                        <label className="update-file-trigger">
                          <CameraIcon size={13} />
                          <span>{photoFile ? photoFile.name : 'Adjuntar foto (opcional)'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic"
                            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                            hidden
                          />
                        </label>
                        {photoFile && (
                          <button
                            type="button"
                            className="update-file-clear"
                            onClick={() => setPhotoFile(null)}
                          >
                            Quitar
                          </button>
                        )}
                      </div>

                      {actionError && <p className="update-error-msg">{actionError}</p>}

                      <div className="cure-confirm-actions">
                        <button
                          type="button"
                          className="update-btn-secondary"
                          onClick={() => setIsFormOpen(false)}
                          disabled={isSubmitting}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className={
                            painIntensity === 0 ? 'update-btn-cure-confirm' : 'update-btn-primary'
                          }
                          disabled={isSubmitting}
                        >
                          {isSubmitting
                            ? 'Guardando...'
                            : painIntensity === 0
                              ? 'Guardar y curar'
                              : `Guardar Actualización #${nextUpdateNumber}`}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
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
                ) : isResolvedHistory ? (
                  <span className="ai-context-chip">Historial curado</span>
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

export const MuscleDetailAndAiPanel: React.FC<MuscleDetailAndAiPanelProps> = ({
  muscle,
  allMuscles,
  latestHealthCheck,
  photos,
  snapshotUri,
  resolvedRecord,
  onSelectMuscle,
  onSaveUpdate,
  onCureMuscle,
}) => {
  const knowledge = useMemo(() => {
    if (!muscle) return null;
    return getMuscleKnowledge(muscle);
  }, [muscle]);

  const musclePhotos = useMemo(() => {
    if (!muscle) return [];
    return photos.filter(
      (p) => p.muscleId.trim().toLowerCase() === muscle.id.trim().toLowerCase()
    );
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
                registro activo o historial para consultar síntomas e informes.
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

  return (
    <SelectedMuscleContent
      key={muscle.id}
      muscle={muscle}
      allMuscles={allMuscles}
      knowledge={knowledge}
      generalSymptoms={generalSymptoms}
      photos={photos}
      musclePhotos={musclePhotos}
      snapshotUri={snapshotUri}
      resolvedRecord={resolvedRecord}
      onSelectMuscle={onSelectMuscle}
      onSaveUpdate={onSaveUpdate}
      onCureMuscle={onCureMuscle}
    />
  );
};
