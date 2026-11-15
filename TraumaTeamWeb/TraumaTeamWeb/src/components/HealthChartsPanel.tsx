import React, { useEffect, useMemo, useRef, useState } from 'react';
import { groupSamplesByDay } from '../services/backend-api';
import type {
  DashboardSample,
  EnvironmentType,
  SampleMetric,
  VitalSignsData,
} from '../types/dashboard';
import { EnvironmentBannerBackdrop } from './EnvironmentBannerBackdrop';
import {
  ActivityIcon,
  ChevronRightIcon,
  OxygenIcon,
  FootprintsIcon,
  HeartRateIcon,
  MoonIcon,
  OrbitIcon,
  XIcon,
  StressIcon,
} from './Icons';

interface HealthChartsPanelProps {
  vitals: VitalSignsData;
  allSamples: DashboardSample[];
  environment?: EnvironmentType;
}

interface MetricDescriptor {
  key: SampleMetric;
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  nominalMin?: number;
  nominalMax?: number;
  decimals: number;
}

const METRICS: MetricDescriptor[] = [
  {
    key: 'heart_rate',
    label: 'Heart Rate',
    shortLabel: 'Pulse',
    unit: 'BPM',
    color: '#ef4444',
    nominalMin: 60,
    nominalMax: 100,
    decimals: 0,
  },
  {
    key: 'spo2',
    label: 'Oxygen SpO2',
    shortLabel: 'Oxygen',
    unit: '%',
    color: '#0284c7',
    nominalMin: 95,
    nominalMax: 100,
    decimals: 0,
  },
  {
    key: 'stress',
    label: 'Stress Level',
    shortLabel: 'Stress',
    unit: '/100',
    color: '#f59e0b',
    nominalMin: 0,
    nominalMax: 65,
    decimals: 0,
  },
  {
    key: 'sleep',
    label: 'Sleep',
    shortLabel: 'Sleep',
    unit: 'h',
    color: '#7c3aed',
    nominalMin: 7,
    nominalMax: 9,
    decimals: 1,
  },
  {
    key: 'steps',
    label: 'Physical Activity',
    shortLabel: 'Steps',
    unit: 'steps',
    color: '#06b6d4',
    decimals: 0,
  },
];

const MAX_DISPLAY_SAMPLES = 48;

function renderMetricIcon(metric: SampleMetric, size = 14) {
  switch (metric) {
    case 'heart_rate':
      return <HeartRateIcon size={size} />;
    case 'spo2':
      return <OxygenIcon size={size} />;
    case 'stress':
      return <StressIcon size={size} />;
    case 'sleep':
      return <MoonIcon size={size} />;
    case 'steps':
      return <FootprintsIcon size={size} />;
  }
}

function formatMetricNumber(value: number, decimals: number): string {
  if (decimals > 0) return value.toFixed(decimals);
  return Math.round(value).toLocaleString('en-US');
}

function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

function buildSmoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function canTransitionDisplay(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('transition-behavior', 'allow-discrete') &&
    CSS.supports('transition-property', 'display')
  );
}

function supportsTopLayerExit(): boolean {
  return (
    canTransitionDisplay() &&
    typeof CSS !== 'undefined' &&
    CSS.supports('transition-property', 'overlay') &&
    !navigator.userAgent.includes('Firefox')
  );
}

async function closeTopLayer(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open || dialog.hasAttribute('data-closing')) return;
  if (supportsTopLayerExit()) {
    dialog.close();
    return;
  }
  dialog.setAttribute('data-closing', '');
  await Promise.allSettled(
    dialog.getAnimations({ subtree: true }).map((a) => a.finished)
  );
  if (dialog.hasAttribute('data-closing')) {
    dialog.close();
    dialog.removeAttribute('data-closing');
  }
}

export const HealthChartsPanel: React.FC<HealthChartsPanelProps> = ({
  vitals,
  allSamples,
  environment = 'tierra',
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageContentRef = useRef<HTMLDivElement | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<SampleMetric>('heart_rate');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [stageHeight, setStageHeight] = useState<number | null>(null);

  // Fallback para light-dismiss y salida animada en navegadores sin transición de top-layer
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      if (supportsTopLayerExit()) return;
      event.preventDefault();
      void closeTopLayer(dialog);
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (isDialogContent) return;
      void closeTopLayer(dialog);
    };

    dialog.addEventListener('cancel', handleCancel);
    const needsBackdropFallback =
      !('closedBy' in HTMLDialogElement.prototype) || !supportsTopLayerExit();
    if (needsBackdropFallback) {
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (needsBackdropFallback) {
        dialog.removeEventListener('click', handleBackdropClick);
      }
    };
  }, []);

  // Medición dinámica para animar suave el cambio de tamaño entre métricas
  useEffect(() => {
    const contentEl = stageContentRef.current;
    if (!contentEl || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      if (!dialogRef.current?.open) return;
      for (const entry of entries) {
        const measured =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (measured > 0) {
          setStageHeight(Math.ceil(measured));
        }
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [selectedMetric]);

  const activeMeta = useMemo(
    () => METRICS.find((m) => m.key === selectedMetric) ?? METRICS[0],
    [selectedMetric]
  );

  const fullMetricSamples = useMemo(
    () => allSamples.filter((s) => s.metric === selectedMetric),
    [allSamples, selectedMetric]
  );

  const metricSeries = useMemo(() => {
    const sorted = fullMetricSamples
      .slice()
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

    if (sorted.length > MAX_DISPLAY_SAMPLES) {
      return sorted.slice(sorted.length - MAX_DISPLAY_SAMPLES);
    }
    return sorted;
  }, [fullMetricSamples]);

  const stats = useMemo(() => {
    if (metricSeries.length === 0) return null;
    let sum = 0;
    let minVal = metricSeries[0].value;
    let maxVal = metricSeries[0].value;
    for (const s of metricSeries) {
      sum += s.value;
      if (s.value < minVal) minVal = s.value;
      if (s.value > maxVal) maxVal = s.value;
    }
    const latest = metricSeries[metricSeries.length - 1];
    return {
      avg: sum / metricSeries.length,
      min: minVal,
      max: maxVal,
      latest: latest.value,
      latestTime: latest.measuredAt,
      count: metricSeries.length,
    };
  }, [metricSeries]);

  const dailySummaries = useMemo(() => groupSamplesByDay(fullMetricSamples), [fullMetricSamples]);

  const chartGeometry = useMemo(() => {
    const width = 560;
    const height = 160;
    const padLeft = 36;
    const padRight = 14;
    const padTop = 14;
    const padBottom = 24;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    if (metricSeries.length === 0) {
      return {
        width,
        height,
        padLeft,
        padRight,
        padTop,
        padBottom,
        innerW,
        innerH,
        points: [],
        minVal: 0,
        maxVal: 100,
      };
    }

    let minVal = Math.min(...metricSeries.map((p) => p.value));
    let maxVal = Math.max(...metricSeries.map((p) => p.value));
    if (activeMeta.nominalMin !== undefined) minVal = Math.min(minVal, activeMeta.nominalMin);
    if (activeMeta.nominalMax !== undefined) maxVal = Math.max(maxVal, activeMeta.nominalMax);

    if (minVal === maxVal) {
      minVal = Math.max(0, minVal - 5);
      maxVal += 5;
    } else {
      const span = maxVal - minVal;
      minVal = Math.max(0, minVal - span * 0.12);
      maxVal += span * 0.12;
    }

    const span = Math.max(0.001, maxVal - minVal);
    const points = metricSeries.map((sample, idx) => {
      const rx = metricSeries.length === 1 ? 0.5 : idx / (metricSeries.length - 1);
      const ry = (sample.value - minVal) / span;
      return {
        sample,
        x: padLeft + rx * innerW,
        y: padTop + innerH - ry * innerH,
      };
    });

    return { width, height, padLeft, padRight, padTop, padBottom, innerW, innerH, points, minVal, maxVal };
  }, [metricSeries, activeMeta]);

  const linePathD = useMemo(() => buildSmoothCurvePath(chartGeometry.points), [chartGeometry.points]);

  const areaPathD = useMemo(() => {
    if (chartGeometry.points.length < 2 || !linePathD) return '';
    const baseY = chartGeometry.padTop + chartGeometry.innerH;
    const first = chartGeometry.points[0];
    const last = chartGeometry.points[chartGeometry.points.length - 1];
    return `${linePathD} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  }, [chartGeometry, linePathD]);

  const activeHoverPoint =
    hoveredIdx !== null && chartGeometry.points[hoveredIdx]
      ? chartGeometry.points[hoveredIdx]
      : chartGeometry.points[chartGeometry.points.length - 1] ?? null;

  const openHistoryModal = (metric: SampleMetric) => {
    setSelectedMetric(metric);
    setHoveredIdx(null);
    setStageHeight(null);
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) {
      dlg.removeAttribute('data-closing');
      dlg.showModal();
    }
  };

  const closeHistoryModal = () => {
    const dlg = dialogRef.current;
    if (dlg?.open) {
      void closeTopLayer(dlg);
    }
  };

  const quickMetrics: {
    key: SampleMetric;
    label: string;
    tone: string;
    valueText: string;
    unit: string;
  }[] = [
    {
      key: 'heart_rate',
      label: 'Pulse',
      tone: 'tone-rose',
      valueText: vitals.heartRate !== null ? `${vitals.heartRate}` : '--',
      unit: 'BPM',
    },
    {
      key: 'spo2',
      label: 'Oxygen',
      tone: 'tone-sky',
      valueText: vitals.spo2 !== null ? `${vitals.spo2}` : '--',
      unit: '%',
    },
    {
      key: 'stress',
      label: 'Stress',
      tone: 'tone-amber',
      valueText: vitals.stress !== null ? `${vitals.stress}` : '--',
      unit: '/100',
    },
    {
      key: 'sleep',
      label: 'Sleep',
      tone: 'tone-sky',
      valueText: vitals.sleepHours !== null ? vitals.sleepHours.toFixed(1) : '--',
      unit: 'h',
    },
    {
      key: 'steps',
      label: 'Steps',
      tone: 'tone-sky',
      valueText: vitals.steps !== null ? vitals.steps.toLocaleString('en-US') : '--',
      unit: 'steps',
    },
  ];

  const nominalMinY =
    activeMeta.nominalMin !== undefined
      ? chartGeometry.padTop +
        chartGeometry.innerH -
        ((activeMeta.nominalMin - chartGeometry.minVal) /
          Math.max(0.001, chartGeometry.maxVal - chartGeometry.minVal)) *
          chartGeometry.innerH
      : null;

  const nominalMaxY =
    activeMeta.nominalMax !== undefined
      ? chartGeometry.padTop +
        chartGeometry.innerH -
        ((activeMeta.nominalMax - chartGeometry.minVal) /
          Math.max(0.001, chartGeometry.maxVal - chartGeometry.minVal)) *
          chartGeometry.innerH
      : null;

  return (
    <>
      {/* History shortcuts using the visual language of the vitals cards */}
      <section className="history-summary-card" aria-label="Biometric flight log">
        <div className="history-card-head">
          <div className="history-head-title">
            <span className="sym-icon-box tone-sky" aria-hidden="true">
              <OrbitIcon size={24} />
            </span>
            <div className="history-head-copy">
              <h2>Flight Log</h2>
            </div>
          </div>

          <button
            type="button"
            className="history-open-btn"
            onClick={() => openHistoryModal(selectedMetric)}
          >
            <span>Explore</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>

        <div className="history-metric-list">
          {quickMetrics.map((qm) => (
            <button
              key={qm.key}
              type="button"
              className="history-metric-row"
              onClick={() => openHistoryModal(qm.key)}
              aria-label={`View ${qm.label} history: ${qm.valueText} ${qm.unit}`}
            >
              <span className={`sym-icon-box ${qm.tone}`} aria-hidden="true">
                {renderMetricIcon(qm.key, 24)}
              </span>
              <span className="history-metric-label">{qm.label}</span>
              <span className="history-metric-value">
                <strong>{qm.valueText}</strong>
                <span>{qm.unit}</span>
              </span>
              <ChevronRightIcon size={14} />
            </button>
          ))}
        </div>
      </section>

      {/* Native modal dialog with closedby="any" + scroll containment */}
      <dialog
        ref={dialogRef}
        className="history-native-dialog"
        aria-labelledby="history-dialog-title"
        {...({ closedby: 'any' } as Record<string, unknown>)}
        onClose={() => setHoveredIdx(null)}
      >
        <div className="history-modal-inner">
          {/* Location SVG banner matching mobile's EnvironmentBannerBackdrop */}
          <div className="history-space-banner" data-environment={environment}>
            <EnvironmentBannerBackdrop environment={environment} />

            <div className="history-banner-overlay">
              <div className="history-banner-title">
                <span className="history-banner-kicker">FLIGHT LOG</span>
                <h3 id="history-dialog-title">{activeMeta.label}</h3>
                <span>
                  {stats
                    ? `${stats.count} recent records · latest sample ${formatDateTimeShort(stats.latestTime)}`
                    : 'No synced readings for this signal'}
                </span>
              </div>

              <button
                type="button"
                className="modal-close-cosmic"
                onClick={closeHistoryModal}
                aria-label="Close flight log"
              >
                <XIcon size={17} />
              </button>
            </div>
          </div>

          <div className="history-modal-body">
            {/* Selector limpio de métrica */}
            <div className="metric-tabs-strip" role="tablist" aria-label="Select vital signal">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={selectedMetric === m.key}
                  className={`metric-tab-btn ${selectedMetric === m.key ? 'active' : ''}`}
                  style={
                    selectedMetric === m.key
                      ? ({ '--tab-accent': m.color } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => {
                    setSelectedMetric(m.key);
                    setHoveredIdx(null);
                  }}
                >
                  {renderMetricIcon(m.key, 13)}
                  <span>{m.shortLabel}</span>
                </button>
              ))}
            </div>

            {/* Escenario con animación suave de alto y entrada al cambiar métrica */}
            <div
              className="history-stage-sizer"
              style={stageHeight !== null ? { blockSize: `${stageHeight}px` } : undefined}
            >
              <div key={selectedMetric} ref={stageContentRef} className="history-metric-stage">
                {/* 3 métricas clave simples */}
                <div className="stats-trio-grid">
              <div className="stat-trio-box">
                <span>Latest reading</span>
                <strong style={{ color: activeMeta.color }}>
                  {stats ? `${formatMetricNumber(stats.latest, activeMeta.decimals)} ${activeMeta.unit}` : '--'}
                </strong>
              </div>
              <div className="stat-trio-box">
                <span>Average</span>
                <strong className="accent">
                  {stats ? `${formatMetricNumber(stats.avg, activeMeta.decimals)} ${activeMeta.unit}` : '--'}
                </strong>
              </div>
              <div className="stat-trio-box">
                <span>Min – Max</span>
                <strong className="range">
                  {stats
                    ? `${formatMetricNumber(stats.min, activeMeta.decimals)} – ${formatMetricNumber(
                        stats.max,
                        activeMeta.decimals
                      )} ${activeMeta.unit}`
                    : '--'}
                </strong>
              </div>
            </div>

            {/* Curva suave simplificada */}
            <div className="linechart-panel">
              <div className="linechart-header">
                <strong>Recent trend</strong>
                {activeHoverPoint && (
                  <span className="linechart-point-pill" style={{ borderColor: activeMeta.color }}>
                    <strong>
                      {formatMetricNumber(activeHoverPoint.sample.value, activeMeta.decimals)} {activeMeta.unit}
                    </strong>
                    <span>{formatDateTimeShort(activeHoverPoint.sample.measuredAt)}</span>
                  </span>
                )}
              </div>

              {chartGeometry.points.length > 0 ? (
                <div className="linechart-svg-wrap">
                  <svg
                    viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                    className="linechart-svg"
                    role="img"
                    aria-label={`${activeMeta.label} chart`}
                  >
                    <defs>
                      <linearGradient id="history-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeMeta.color} stopOpacity="0.24" />
                        <stop offset="100%" stopColor={activeMeta.color} stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {[0, 0.5, 1].map((t, idx) => {
                      const y = chartGeometry.padTop + t * chartGeometry.innerH;
                      const val =
                        chartGeometry.maxVal - t * (chartGeometry.maxVal - chartGeometry.minVal);
                      return (
                        <g key={idx}>
                          <line
                            x1={chartGeometry.padLeft}
                            y1={y}
                            x2={chartGeometry.width - chartGeometry.padRight}
                            y2={y}
                            stroke="var(--chart-grid)"
                            strokeDasharray="3 4"
                          />
                          <text
                            x={chartGeometry.padLeft - 6}
                            y={y + 3}
                            textAnchor="end"
                            fill="var(--text-muted)"
                            fontSize="9.5"
                          >
                            {formatMetricNumber(val, activeMeta.decimals)}
                          </text>
                        </g>
                      );
                    })}

                    {nominalMinY !== null &&
                      nominalMinY >= chartGeometry.padTop &&
                      nominalMinY <= chartGeometry.padTop + chartGeometry.innerH && (
                        <line
                          x1={chartGeometry.padLeft}
                          y1={nominalMinY}
                          x2={chartGeometry.width - chartGeometry.padRight}
                          y2={nominalMinY}
                          stroke="#93DEFF"
                          strokeWidth="1.4"
                          strokeDasharray="4 4"
                          strokeOpacity="0.85"
                        />
                      )}

                    {nominalMaxY !== null &&
                      nominalMaxY >= chartGeometry.padTop &&
                      nominalMaxY <= chartGeometry.padTop + chartGeometry.innerH && (
                        <line
                          x1={chartGeometry.padLeft}
                          y1={nominalMaxY}
                          x2={chartGeometry.width - chartGeometry.padRight}
                          y2={nominalMaxY}
                          stroke="#93DEFF"
                          strokeWidth="1.4"
                          strokeDasharray="4 4"
                          strokeOpacity="0.85"
                        />
                      )}

                    {areaPathD && <path d={areaPathD} fill="url(#history-area-fill)" />}

                    {linePathD && (
                      <path
                        d={linePathD}
                        fill="none"
                        stroke={activeMeta.color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {chartGeometry.points.map((pt, idx) => {
                      const isActive = activeHoverPoint?.sample.sampleId === pt.sample.sampleId;
                      return (
                        <g key={`${pt.sample.id}-${idx}`}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isActive ? 4.6 : 2.3}
                            fill={isActive ? '#ffffff' : activeMeta.color}
                            stroke={activeMeta.color}
                            strokeWidth={isActive ? 2.2 : 1}
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={11}
                            fill="transparent"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onClick={() => setHoveredIdx(idx)}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="linechart-empty-compact">
                  <ActivityIcon size={16} />
                  <span>No {activeMeta.shortLabel.toLowerCase()} readings recorded on the server</span>
                </div>
              )}
            </div>

            {/* Resumen por jornada simplificado con barra visual */}
            {dailySummaries.length > 0 && (
              <div className="daily-summary-stack">
                <div className="daily-stack-heading">
                  <span>Resumen por jornada</span>
                  <small>Last {Math.min(5, dailySummaries.length)} days</small>
                </div>

                {dailySummaries.slice(0, 5).map((day) => {
                  const spread = Math.max(0.001, day.max - day.min);
                  const avgPct = Math.min(100, Math.max(0, ((day.avg - day.min) / spread) * 100));

                  return (
                    <div key={day.dateKey} className="daily-card-simple">
                      <div className="dcs-top">
                        <div className="dcs-date">
                          <strong>{day.dateLabel}</strong>
                          <span>{day.count} lecturas</span>
                        </div>
                        <span className="dcs-avg-pill" style={{ color: activeMeta.color }}>
                          Avg {formatMetricNumber(day.avg, activeMeta.decimals)} {activeMeta.unit}
                        </span>
                      </div>

                      {selectedMetric === 'sleep' ? (
                        <div className="dcm-sleep-pill">
                          <span>Descanso registrado</span>
                          <strong>{formatMetricNumber(day.max, 1)} h</strong>
                        </div>
                      ) : (
                        <div className="dcs-range-wrap">
                          <div className="dcs-range-labels">
                            <span>
                              Min <strong>{formatMetricNumber(day.min, activeMeta.decimals)}</strong>{' '}
                              <small>({day.minTime})</small>
                            </span>
                            <span>
                              Max <strong>{formatMetricNumber(day.max, activeMeta.decimals)}</strong>{' '}
                              <small>({day.maxTime})</small>
                            </span>
                          </div>
                          <div className="dcs-range-track">
                            <span
                              className="dcs-range-fill"
                              style={{ backgroundColor: activeMeta.color }}
                            />
                            <span
                              className="dcs-range-marker"
                              style={{ left: `${avgPct}%`, borderColor: activeMeta.color }}
                              title={`Average ${formatMetricNumber(day.avg, activeMeta.decimals)} ${activeMeta.unit}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
};
