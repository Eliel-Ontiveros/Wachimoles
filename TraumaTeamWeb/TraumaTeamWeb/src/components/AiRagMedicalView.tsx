import React, { useMemo, useState } from 'react';
import { generateGlobalAiRagInsights } from '../data/anatomy-catalog';
import type {
  BodyConditionRecord,
  DailyHealthCheck,
  MoodScore,
  VitalSignsData,
} from '../types/dashboard';
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ChevronRightIcon,
  DropletsIcon,
  FileTextIcon,
  HeartIcon,
  MoonIcon,
  ShieldAlertIcon,
  SmileIcon,
  SparklesIcon,
  ThermometerIcon,
} from './Icons';

interface AiRagMedicalViewProps {
  vitals: VitalSignsData;
  conditions: BodyConditionRecord[];
  healthChecks: DailyHealthCheck[];
  healthChecksStatus: 'ok' | 'unauthorized' | 'error' | 'idle';
  onSelectMuscle: (muscleId: string) => void;
  onOpenBackendConfig: () => void;
}

const MOOD_LABELS: Record<MoodScore, string> = {
  1: 'Muy agotado (1/5)',
  2: 'Cansado (2/5)',
  3: 'Neutral (3/5)',
  4: 'Estable (4/5)',
  5: 'Óptimo (5/5)',
};

export const AiRagMedicalView: React.FC<AiRagMedicalViewProps> = ({
  vitals,
  conditions,
  healthChecks,
  healthChecksStatus,
  onSelectMuscle,
  onOpenBackendConfig,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>(
    'all'
  );

  const insights = useMemo(
    () => generateGlobalAiRagInsights(vitals, conditions, healthChecks),
    [vitals, conditions, healthChecks]
  );

  const filteredInsights = useMemo(() => {
    const order = { critical: 0, warning: 1, info: 2 };
    const sorted = insights.slice().sort((a, b) => order[a.severity] - order[b.severity]);
    if (severityFilter === 'all') return sorted;
    return sorted.filter((i) => i.severity === severityFilter);
  }, [insights, severityFilter]);

  const counts = useMemo(
    () => ({
      critical: insights.filter((i) => i.severity === 'critical').length,
      warning: insights.filter((i) => i.severity === 'warning').length,
      info: insights.filter((i) => i.severity === 'info').length,
    }),
    [insights]
  );

  return (
    <div className="airag-wrapper">
      {/* Cabecera de motor IA/RAG */}
      <div className="airag-summary-bar">
        <div className="airag-badge-group">
          <button
            type="button"
            className={`sev-filter-btn ${severityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('all')}
          >
            Todos ({insights.length})
          </button>
          <button
            type="button"
            className={`sev-filter-btn sev-critical ${
              severityFilter === 'critical' ? 'active' : ''
            }`}
            onClick={() => setSeverityFilter('critical')}
          >
            Críticos ({counts.critical})
          </button>
          <button
            type="button"
            className={`sev-filter-btn sev-warning ${
              severityFilter === 'warning' ? 'active' : ''
            }`}
            onClick={() => setSeverityFilter('warning')}
          >
            Vigilancia ({counts.warning})
          </button>
          <button
            type="button"
            className={`sev-filter-btn sev-info ${severityFilter === 'info' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('info')}
          >
            Base ({counts.info})
          </button>
        </div>
      </div>

      {/* Lista de hallazgos IA/RAG */}
      <div className="airag-cards-list">
        {filteredInsights.map((insight) => (
          <article key={insight.id} className={`airag-card sev-${insight.severity}`}>
            <div className="airag-card-head">
              <span className={`airag-sev-pill sev-${insight.severity}`}>
                {insight.severity === 'critical' ? (
                  <ShieldAlertIcon size={13} />
                ) : insight.severity === 'warning' ? (
                  <AlertTriangleIcon size={13} />
                ) : (
                  <SparklesIcon size={13} />
                )}
                <span>
                  {insight.severity === 'critical'
                    ? 'CRÍTICO'
                    : insight.severity === 'warning'
                    ? 'VIGILANCIA'
                    : 'INFORMATIVO'}
                </span>
              </span>
              <span className="airag-category">{insight.category}</span>
            </div>

            <h4 className="airag-card-title">{insight.title}</h4>
            <p className="airag-card-reasoning">{insight.reasoning}</p>

            <div className="airag-action-box">
              <strong>Sugerencia médica IA:</strong> {insight.suggestedAction}
            </div>

            <div className="airag-card-foot">
              <div className="airag-sources">
                <BookOpenIcon size={13} />
                <span>{insight.evidenceSources.join(' · ')}</span>
              </div>

              {insight.relatedMuscleId && (
                <button
                  type="button"
                  className="btn-jump-muscle"
                  onClick={() => onSelectMuscle(insight.relatedMuscleId!)}
                >
                  <span>Ver en 3D</span>
                  <ChevronRightIcon size={13} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Cuestionarios diarios de salud reportados desde TraumaTeamMovil */}
      <div className="health-checks-section">
        <div className="section-mini-header">
          <div className="section-mini-title">
            <FileTextIcon size={15} />
            <span>Check-ins Clínicos Diarios ({healthChecks.length})</span>
          </div>
          {healthChecksStatus === 'unauthorized' && (
            <button type="button" className="btn-link-inline" onClick={onOpenBackendConfig}>
              Ingresar Token API
            </button>
          )}
        </div>

        {healthChecks.length > 0 ? (
          <div className="health-checks-list">
            {healthChecks.slice(0, 6).map((hc) => (
              <div key={hc.id} className={`health-check-card status-${hc.overallStatus}`}>
                <div className="hc-head">
                  <strong>{hc.dateIso}</strong>
                  <span className={`hc-status-badge status-${hc.overallStatus}`}>
                    {hc.overallStatus === 'critical'
                      ? 'CRÍTICO'
                      : hc.overallStatus === 'warning'
                      ? 'VIGILANCIA'
                      : 'NOMINAL'}
                  </span>
                </div>

                <div className="hc-metrics-strip">
                  <span>
                    <DropletsIcon size={12} /> Glucosa:{' '}
                    <b>{hc.bloodSugarMgDl !== null ? `${hc.bloodSugarMgDl} mg/dL` : '--'}</b>
                  </span>
                  <span>
                    <HeartIcon size={12} /> PA:{' '}
                    <b>
                      {hc.systolicBp !== null && hc.diastolicBp !== null
                        ? `${hc.systolicBp}/${hc.diastolicBp}`
                        : '--'}
                    </b>
                  </span>
                  <span>
                    <ThermometerIcon size={12} /> Temp:{' '}
                    <b>{hc.temperatureC !== null ? `${hc.temperatureC} °C` : '--'}</b>
                  </span>
                  <span>
                    <MoonIcon size={12} /> Sueño:{' '}
                    <b>{hc.sleepHours !== null ? `${hc.sleepHours} h` : '--'}</b>
                  </span>
                  <span>
                    <SmileIcon size={12} /> Ánimo: <b>{MOOD_LABELS[hc.mood]}</b>
                  </span>
                </div>

                {hc.symptoms.length > 0 && (
                  <div className="hc-symptoms-row">
                    {hc.symptoms.map((sym) => (
                      <span key={sym} className="hc-symptom-chip">
                        {sym}
                      </span>
                    ))}
                  </div>
                )}

                {hc.notes && <p className="hc-notes">“{hc.notes}”</p>}
                <p className="hc-reco">{hc.recommendation}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="hc-empty-box">
            {healthChecksStatus === 'unauthorized' ? (
              <p>
                El endpoint <code>GET /dashboard/health-checks</code> requiere{' '}
                <code>DASHBOARD_API_TOKEN</code> (Bearer). Configura el token en el botón superior
                para consultar el historial de cuestionarios diarios desde el móvil.
              </p>
            ) : (
              <p>
                Aún no hay cuestionarios diarios sincronizados para este astronauta en el servidor.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
