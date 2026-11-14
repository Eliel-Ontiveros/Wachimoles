import React, { useMemo } from 'react';
import type {
  DailyHealthCheck,
  HealthStatusLevel,
  VitalSignsData,
} from '../types/dashboard';
import {
  ActivityIcon,
  DropletsIcon,
  SmileIcon,
  ThermometerIcon,
  ZapIcon,
} from './Icons';

interface SymptomPulseCardsProps {
  latestCheck: DailyHealthCheck | null;
  vitals: VitalSignsData;
}

const STATUS_META: Record<
  HealthStatusLevel,
  { label: string; color: string; dotColor: string; bg: string; border: string }
> = {
  normal: {
    label: 'Óptimo',
    color: '#0369a1',
    dotColor: '#93DEFF',
    bg: 'rgba(147, 222, 255, 0.28)',
    border: '#93DEFF',
  },
  warning: {
    label: 'Vigilar',
    color: '#d97706',
    dotColor: '#d97706',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.45)',
  },
  critical: {
    label: 'Atención',
    color: '#dc2626',
    dotColor: '#dc2626',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.45)',
  },
};

function evalSpo2(v: number | null): HealthStatusLevel | null {
  if (v === null || v <= 0) return null;
  if (v < 90) return 'critical';
  if (v < 95) return 'warning';
  return 'normal';
}

function evalStress(v: number | null): HealthStatusLevel | null {
  if (v === null) return null;
  if (v >= 85) return 'critical';
  if (v >= 68) return 'warning';
  return 'normal';
}

function StatusBadge({ status }: { status: HealthStatusLevel | null }) {
  if (!status) {
    return <span className="sym-pill neutral">Sin toma</span>;
  }
  const meta = STATUS_META[status];
  return (
    <span
      className="sym-pill"
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
    >
      <i
        style={{
          backgroundColor: meta.dotColor,
          boxShadow: status === 'normal' ? '0 0 0 1px rgba(3, 105, 161, 0.3)' : undefined,
        }}
      />
      {meta.label}
    </span>
  );
}

type GaugeMode = 'low-good' | 'high-good' | 'bilateral';
type BilateralBand =
  | 'low-critical'
  | 'low-warning'
  | 'normal'
  | 'high-warning'
  | 'high-critical';

interface UnilateralIndexRanges {
  green: string;
  yellow: string;
  red: string;
}

interface BilateralIndexRanges {
  lowCritical: string;
  lowWarning: string;
  normal: string;
  highWarning: string;
  highCritical: string;
}

function evalBloodSugarBand(v: number | null): BilateralBand | null {
  if (v === null) return null;
  if (v < 55) return 'low-critical';
  if (v < 70) return 'low-warning';
  if (v > 180) return 'high-critical';
  if (v > 139) return 'high-warning';
  return 'normal';
}

function evalBloodPressureBand(
  sys: number | null,
  dia: number | null
): BilateralBand | null {
  if (sys === null && dia === null) return null;
  if ((sys !== null && sys >= 140) || (dia !== null && dia >= 90)) {
    return 'high-critical';
  }
  if (sys !== null && sys < 80) return 'low-critical';
  if ((sys !== null && sys > 120) || (dia !== null && dia > 80)) {
    return 'high-warning';
  }
  if ((sys !== null && sys < 90) || (dia !== null && dia < 60)) {
    return 'low-warning';
  }
  return 'normal';
}

function evalTemperatureBand(t: number | null): BilateralBand | null {
  if (t === null) return null;
  if (t < 35.2) return 'low-critical';
  if (t < 36.0) return 'low-warning';
  if (t >= 38.1) return 'high-critical';
  if (t >= 37.5) return 'high-warning';
  return 'normal';
}

function bandToStatus(band: BilateralBand | null): HealthStatusLevel | null {
  if (!band) return null;
  if (band === 'normal') return 'normal';
  if (band === 'low-warning' || band === 'high-warning') return 'warning';
  return 'critical';
}

function computeUnilateralPointerPct(
  mode: 'low-good' | 'high-good',
  status: HealthStatusLevel | null,
  localRatio = 0.5
): number {
  const clamped = Math.max(0, Math.min(1, localRatio));
  if (mode === 'low-good') {
    if (status === 'normal') return Math.round(6 + clamped * 22);
    if (status === 'warning') return Math.round(39 + clamped * 22);
    if (status === 'critical') return Math.round(72 + clamped * 22);
    return 0;
  }
  if (status === 'critical') return Math.round(6 + clamped * 22);
  if (status === 'warning') return Math.round(39 + clamped * 22);
  if (status === 'normal') return Math.round(74 + clamped * 20);
  return 0;
}

function computeBilateralPointerPct(
  band: BilateralBand | null,
  localRatio = 0.5
): number {
  const clamped = Math.max(0, Math.min(1, localRatio));
  if (band === 'low-critical') return Math.round(4 + clamped * 11);
  if (band === 'low-warning') return Math.round(21 + clamped * 14);
  if (band === 'normal') return Math.round(41 + clamped * 18);
  if (band === 'high-warning') return Math.round(65 + clamped * 14);
  if (band === 'high-critical') return Math.round(85 + clamped * 11);
  return 0;
}

function MiniWaveStrip({
  active,
  mode,
  status,
  activeBand,
  pointerPct,
  ranges,
  bilateralRanges,
}: {
  active: boolean;
  mode: GaugeMode;
  status: HealthStatusLevel | null;
  activeBand?: BilateralBand | null;
  pointerPct: number;
  ranges?: UnilateralIndexRanges;
  bilateralRanges?: BilateralIndexRanges;
}) {
  const safePointer = Math.max(4, Math.min(96, pointerPct));

  const titleText =
    mode === 'bilateral' && bilateralRanges
      ? `Rojo (${bilateralRanges.lowCritical}) · Amarillo (${bilateralRanges.lowWarning}) · Óptimo (${bilateralRanges.normal}) · Amarillo (${bilateralRanges.highWarning}) · Rojo (${bilateralRanges.highCritical})`
      : ranges
        ? `Óptimo (${ranges.green}) · Amarillo (${ranges.yellow}) · Rojo (${ranges.red})`
        : undefined;

  return (
    <div className="sym-visual-footer">
      <div
        className="sym-index-gauge"
        aria-label={titleText ? `Índices clínicos: ${titleText}` : undefined}
        title={titleText}
      >
        {mode === 'bilateral' && bilateralRanges ? (
          <>
            <div className={`sym-index-bar is-bilateral ${active ? 'is-active' : 'is-idle'}`}>
              <span
                className={`sym-index-seg seg-red ${activeBand === 'low-critical' ? 'is-current' : ''}`}
              />
              <span
                className={`sym-index-seg seg-amber ${activeBand === 'low-warning' ? 'is-current' : ''}`}
              />
              <span
                className={`sym-index-seg seg-green ${activeBand === 'normal' ? 'is-current' : ''}`}
              />
              <span
                className={`sym-index-seg seg-amber ${activeBand === 'high-warning' ? 'is-current' : ''}`}
              />
              <span
                className={`sym-index-seg seg-red ${activeBand === 'high-critical' ? 'is-current' : ''}`}
              />
              {active && status && (
                <i
                  className={`sym-index-pointer tone-${status}`}
                  style={{ left: `${safePointer}%` }}
                />
              )}
            </div>
            <div className="sym-index-legend is-bilateral">
              <span
                className={`sym-idx-item idx-red ${activeBand === 'low-critical' ? 'is-current' : ''}`}
              >
                {bilateralRanges.lowCritical}
              </span>
              <span
                className={`sym-idx-item idx-amber ${activeBand === 'low-warning' ? 'is-current' : ''}`}
              >
                {bilateralRanges.lowWarning}
              </span>
              <span
                className={`sym-idx-item idx-green ${activeBand === 'normal' ? 'is-current' : ''}`}
              >
                {bilateralRanges.normal}
              </span>
              <span
                className={`sym-idx-item idx-amber ${activeBand === 'high-warning' ? 'is-current' : ''}`}
              >
                {bilateralRanges.highWarning}
              </span>
              <span
                className={`sym-idx-item idx-red ${activeBand === 'high-critical' ? 'is-current' : ''}`}
              >
                {bilateralRanges.highCritical}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className={`sym-index-bar ${active ? 'is-active' : 'is-idle'}`}>
              {mode === 'high-good' ? (
                <>
                  <span
                    className={`sym-index-seg seg-red ${status === 'critical' ? 'is-current' : ''}`}
                  />
                  <span
                    className={`sym-index-seg seg-amber ${status === 'warning' ? 'is-current' : ''}`}
                  />
                  <span
                    className={`sym-index-seg seg-green ${status === 'normal' ? 'is-current' : ''}`}
                  />
                </>
              ) : (
                <>
                  <span
                    className={`sym-index-seg seg-green ${status === 'normal' ? 'is-current' : ''}`}
                  />
                  <span
                    className={`sym-index-seg seg-amber ${status === 'warning' ? 'is-current' : ''}`}
                  />
                  <span
                    className={`sym-index-seg seg-red ${status === 'critical' ? 'is-current' : ''}`}
                  />
                </>
              )}
              {active && status && (
                <i
                  className={`sym-index-pointer tone-${status}`}
                  style={{ left: `${safePointer}%` }}
                />
              )}
            </div>
            {ranges && (
              <div className="sym-index-legend">
                {mode === 'high-good' ? (
                  <>
                    <span className={`sym-idx-item idx-red ${status === 'critical' ? 'is-current' : ''}`}>
                      <i />
                      {ranges.red}
                    </span>
                    <span className={`sym-idx-item idx-amber ${status === 'warning' ? 'is-current' : ''}`}>
                      <i />
                      {ranges.yellow}
                    </span>
                    <span className={`sym-idx-item idx-green ${status === 'normal' ? 'is-current' : ''}`}>
                      <i />
                      {ranges.green}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`sym-idx-item idx-green ${status === 'normal' ? 'is-current' : ''}`}>
                      <i />
                      {ranges.green}
                    </span>
                    <span className={`sym-idx-item idx-amber ${status === 'warning' ? 'is-current' : ''}`}>
                      <i />
                      {ranges.yellow}
                    </span>
                    <span className={`sym-idx-item idx-red ${status === 'critical' ? 'is-current' : ''}`}>
                      <i />
                      {ranges.red}
                    </span>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const MOOD_TAG: Record<number, { label: string; status: HealthStatusLevel; pct: number }> = {
  5: { label: 'Óptimo 5/5', status: 'normal', pct: 100 },
  4: { label: 'Estable 4/5', status: 'normal', pct: 80 },
  3: { label: 'Cansado 3/5', status: 'warning', pct: 60 },
  2: { label: 'Tenso 2/5', status: 'warning', pct: 40 },
  1: { label: 'Crítico 1/5', status: 'critical', pct: 20 },
};

export const SymptomPulseCards: React.FC<SymptomPulseCardsProps> = ({
  latestCheck,
  vitals,
}) => {
  const evals = useMemo(() => {
    const spo2Val = vitals.spo2;
    const stressVal = vitals.stress;
    const glucoseVal = latestCheck?.bloodSugarMgDl ?? null;
    const sysVal = latestCheck?.systolicBp ?? null;
    const diaVal = latestCheck?.diastolicBp ?? null;
    const tempVal = latestCheck?.temperatureC ?? null;

    const sSpo2 = evalSpo2(spo2Val);
    const sStress = evalStress(stressVal);
    const glucoseBand = evalBloodSugarBand(glucoseVal);
    const bpBand = evalBloodPressureBand(sysVal, diaVal);
    const tempBand = evalTemperatureBand(tempVal);
    const sGlucose = bandToStatus(glucoseBand);
    const sBp = bandToStatus(bpBand);
    const sTemp = bandToStatus(tempBand);
    const moodVal = latestCheck?.mood ?? null;
    const moodInfo = moodVal !== null ? MOOD_TAG[moodVal] : null;
    const sMood: HealthStatusLevel | null = moodInfo ? moodInfo.status : null;

    return {
      spo2Val,
      stressVal,
      glucoseVal,
      sysVal,
      diaVal,
      tempVal,
      moodVal,
      sSpo2,
      sStress,
      glucoseBand,
      bpBand,
      tempBand,
      sGlucose,
      sBp,
      sTemp,
      sMood,
      moodInfo,
    };
  }, [latestCheck, vitals.spo2, vitals.stress]);

  const reportedSymptoms = useMemo(() => {
    if (!latestCheck || latestCheck.symptoms.length === 0) return [];
    return latestCheck.symptoms.filter((s) => s.toLowerCase() !== 'ninguno');
  }, [latestCheck]);

  return (
    <div className="symptom-pulse-section">
      {/* Grid compacto 2x3 de tarjetas vistosas estilo Pulso */}
      <div className="symptom-cards-grid">
        {/* Oxígeno SpO2 */}
        <article className="symptom-pulse-card">
          <div className="sym-card-head">
            <span className="sym-icon-box tone-sky">
              <DropletsIcon size={14} />
            </span>
            <span className="sym-title">Oxígeno</span>
            <StatusBadge status={evals.sSpo2} />
          </div>
          <div className="sym-val-row">
            <strong>{evals.spo2Val !== null ? `${evals.spo2Val}` : '--'}</strong>
            <span>% SpO2</span>
          </div>
          <MiniWaveStrip
            active={evals.spo2Val !== null && evals.spo2Val > 0}
            mode="high-good"
            status={evals.sSpo2}
            pointerPct={computeUnilateralPointerPct(
              'high-good',
              evals.sSpo2,
              evals.spo2Val === null
                ? 0.5
                : evals.sSpo2 === 'normal'
                  ? (evals.spo2Val - 95) / 5
                  : evals.sSpo2 === 'warning'
                    ? (evals.spo2Val - 90) / 4
                    : (evals.spo2Val - 75) / 15
            )}
            ranges={{ green: '≥95', yellow: '90–94', red: '<90' }}
          />
        </article>

        {/* Nivel de estrés */}
        <article className="symptom-pulse-card">
          <div className="sym-card-head">
            <span className="sym-icon-box tone-amber">
              <ZapIcon size={14} />
            </span>
            <span className="sym-title">Estrés</span>
            <StatusBadge status={evals.sStress} />
          </div>
          <div className="sym-val-row">
            <strong>{evals.stressVal !== null ? `${evals.stressVal}` : '--'}</strong>
            <span>/100</span>
          </div>
          <MiniWaveStrip
            active={evals.stressVal !== null}
            mode="low-good"
            status={evals.sStress}
            pointerPct={computeUnilateralPointerPct(
              'low-good',
              evals.sStress,
              evals.stressVal === null
                ? 0.5
                : evals.sStress === 'normal'
                  ? evals.stressVal / 67
                  : evals.sStress === 'warning'
                    ? (evals.stressVal - 68) / 16
                    : (evals.stressVal - 85) / 15
            )}
            ranges={{ green: '<68', yellow: '68–84', red: '≥85' }}
          />
        </article>

        {/* Glucosa */}
        <article className="symptom-pulse-card">
          <div className="sym-card-head">
            <span className="sym-icon-box tone-sky">
              <DropletsIcon size={14} />
            </span>
            <span className="sym-title">Glucosa</span>
            <StatusBadge status={evals.sGlucose} />
          </div>
          <div className="sym-val-row">
            <strong>{evals.glucoseVal ?? '--'}</strong>
            <span>mg/dL</span>
          </div>
          <MiniWaveStrip
            active={evals.glucoseVal !== null}
            mode="bilateral"
            status={evals.sGlucose}
            activeBand={evals.glucoseBand}
            pointerPct={computeBilateralPointerPct(
              evals.glucoseBand,
              evals.glucoseVal === null
                ? 0.5
                : evals.glucoseBand === 'low-critical'
                  ? (evals.glucoseVal - 30) / 25
                  : evals.glucoseBand === 'low-warning'
                    ? (evals.glucoseVal - 55) / 14
                    : evals.glucoseBand === 'normal'
                      ? (evals.glucoseVal - 70) / 69
                      : evals.glucoseBand === 'high-warning'
                        ? (evals.glucoseVal - 140) / 40
                        : (evals.glucoseVal - 180) / 60
            )}
            bilateralRanges={{
              lowCritical: '<55',
              lowWarning: '55–69',
              normal: '70–139',
              highWarning: '140–180',
              highCritical: '>180',
            }}
          />
        </article>

        {/* Presión arterial */}
        <article className="symptom-pulse-card">
          <div className="sym-card-head">
            <span className="sym-icon-box tone-rose">
              <ActivityIcon size={14} />
            </span>
            <span className="sym-title">Presión Art.</span>
            <StatusBadge status={evals.sBp} />
          </div>
          <div className="sym-val-row">
            <strong>
              {evals.sysVal !== null && evals.diaVal !== null
                ? `${evals.sysVal}/${evals.diaVal}`
                : '--/--'}
            </strong>
            <span>mmHg</span>
          </div>
          <MiniWaveStrip
            active={evals.sBp !== null}
            mode="bilateral"
            status={evals.sBp}
            activeBand={evals.bpBand}
            pointerPct={computeBilateralPointerPct(
              evals.bpBand,
              evals.sysVal === null
                ? 0.5
                : evals.bpBand === 'low-critical'
                  ? (evals.sysVal - 60) / 20
                  : evals.bpBand === 'low-warning'
                    ? evals.sysVal < 90
                      ? (evals.sysVal - 80) / 10
                      : 0.4
                    : evals.bpBand === 'normal'
                      ? (evals.sysVal - 90) / 30
                      : evals.bpBand === 'high-warning'
                        ? evals.sysVal > 120
                          ? (evals.sysVal - 120) / 19
                          : 0.5
                        : evals.sysVal >= 140
                          ? (evals.sysVal - 140) / 40
                          : 0.5
            )}
            bilateralRanges={{
              lowCritical: '<80',
              lowWarning: '80–89',
              normal: '90–120',
              highWarning: '121–139',
              highCritical: '≥140',
            }}
          />
        </article>

        {/* Temperatura */}
        <article className="symptom-pulse-card">
          <div className="sym-card-head">
            <span className="sym-icon-box tone-amber">
              <ThermometerIcon size={14} />
            </span>
            <span className="sym-title">Temperatura</span>
            <StatusBadge status={evals.sTemp} />
          </div>
          <div className="sym-val-row">
            <strong>{evals.tempVal !== null ? evals.tempVal.toFixed(1) : '--'}</strong>
            <span>°C</span>
          </div>
          <MiniWaveStrip
            active={evals.tempVal !== null}
            mode="bilateral"
            status={evals.sTemp}
            activeBand={evals.tempBand}
            pointerPct={computeBilateralPointerPct(
              evals.tempBand,
              evals.tempVal === null
                ? 0.5
                : evals.tempBand === 'low-critical'
                  ? (evals.tempVal - 33.0) / 2.2
                  : evals.tempBand === 'low-warning'
                    ? (evals.tempVal - 35.2) / 0.8
                    : evals.tempBand === 'normal'
                      ? (evals.tempVal - 36.0) / 1.4
                      : evals.tempBand === 'high-warning'
                        ? (evals.tempVal - 37.5) / 0.6
                        : (evals.tempVal - 38.1) / 2
            )}
            bilateralRanges={{
              lowCritical: '<35.2',
              lowWarning: '35.2–36',
              normal: '36–37.4',
              highWarning: '37.5–38',
              highCritical: '≥38.1',
            }}
          />
        </article>

        {/* Estado de ánimo */}
        <article className="symptom-pulse-card">
          <div className="sym-card-head">
            <span className="sym-icon-box tone-emerald">
              <SmileIcon size={14} />
            </span>
            <span className="sym-title">Ánimo</span>
            <StatusBadge status={evals.sMood} />
          </div>
          <div className="sym-val-row mood-size">
            <strong>{evals.moodInfo ? evals.moodInfo.label : '--'}</strong>
          </div>
          <MiniWaveStrip
            active={Boolean(evals.moodInfo)}
            mode="high-good"
            status={evals.sMood}
            pointerPct={
              evals.moodVal === 1
                ? 17
                : evals.moodVal === 2
                  ? 44
                  : evals.moodVal === 3
                    ? 56
                    : evals.moodVal === 4
                      ? 77
                      : evals.moodVal === 5
                        ? 90
                        : 0
            }
            ranges={{ green: '4–5/5', yellow: '2–3/5', red: '1/5' }}
          />
        </article>
      </div>

      {reportedSymptoms.length > 0 && (
        <div className="sym-chips-strip">
          {reportedSymptoms.map((sym) => (
            <span key={sym} className="sym-reported-chip">
              ● {sym}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
