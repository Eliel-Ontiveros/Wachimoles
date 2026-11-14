import React, { useMemo } from 'react';
import shipSprite from '../assets/Naveee (1).svg';
import type { AstronautProfile, VitalSignsData } from '../types/dashboard';
import { ActivityIcon, HeartIcon } from './Icons';

interface RealtimeEcgMonitorProps {
  vitals: VitalSignsData;
  astronaut: AstronautProfile;
}

// Plantilla fiel al ciclo cardíaco normalizado de TraumaTeamMovil (VitalMonitorView.tsx)
const BEAT_TEMPLATE = [
  0.5, 0.5, 0.52, 0.56, 0.54, 0.5, 0.5, 0.44, 0.98, 0.1, 0.48, 0.5, 0.5,
  0.54, 0.62, 0.58, 0.5, 0.5, 0.5, 0.5,
];
const BEAT_WIDTH = 96;
const ECG_HEIGHT = 90;

const MISSION_STARS = [
  { x: 22, y: 14, r: 1.0, o: 0.7 },
  { x: 74, y: 10, r: 1.2, o: 0.85 },
  { x: 122, y: 20, r: 0.9, o: 0.55 },
  { x: 170, y: 11, r: 1.1, o: 0.75 },
  { x: 220, y: 17, r: 1.0, o: 0.65 },
  { x: 274, y: 11, r: 1.3, o: 0.85 },
  { x: 320, y: 24, r: 0.9, o: 0.5 },
  { x: 96, y: 64, r: 0.9, o: 0.45 },
  { x: 248, y: 62, r: 1.0, o: 0.5 },
];

const LOCATION_LABELS: Record<string, string> = {
  tierra: 'Tierra',
  luna: 'Luna',
  marte: 'Marte',
};

function buildBeatPath(cycles: number): string {
  const pts: string[] = [];
  for (let b = 0; b < cycles; b++) {
    const ox = b * BEAT_WIDTH;
    for (let i = 0; i < BEAT_TEMPLATE.length; i++) {
      const x = ox + (i / (BEAT_TEMPLATE.length - 1)) * BEAT_WIDTH;
      const y = (1 - BEAT_TEMPLATE[i]) * ECG_HEIGHT;
      pts.push(`${b === 0 && i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }
  return pts.join(' ');
}

// 5 ciclos exactos (480u = 5 * 96u) para desplazamiento continuo de -20% (-96u) sin cortes
const ECG_VIEWBOX_WIDTH = BEAT_WIDTH * 5;
const ECG_CONTINUOUS_PATH = buildBeatPath(5);

export const RealtimeEcgMonitor: React.FC<RealtimeEcgMonitorProps> = ({ vitals, astronaut }) => {
  const bpm = vitals.heartRate !== null && vitals.heartRate > 0 ? vitals.heartRate : null;
  const isAvailable = vitals.isAvailable && bpm !== null;

  const statusMeta = useMemo(() => {
    if (!isAvailable || bpm === null) {
      return { label: 'Sin señal', color: '#94a3b8', stroke: '#94a3b8' };
    }
    if (bpm >= 115 || bpm < 48) {
      return { label: 'Pulso crítico', color: '#ef4444', stroke: '#ef4444' };
    }
    if (bpm >= 100 || bpm < 55) {
      return { label: 'Pulso elevado', color: '#f59e0b', stroke: '#f59e0b' };
    }
    return { label: 'Pulso en vivo', color: '#0284c7', stroke: '#0284c7' };
  }, [bpm, isAvailable]);

  const beatDurationSec = bpm ? Math.max(0.32, Math.min(1.8, 60 / bpm)) : 3.6;

  return (
    <div className="mission-and-pulse-stack">
      {/* Tarjeta de Misión Espacial (#060b19 estilo SpaceJourneyTimeline) arriba del Pulso */}
      <div className="mission-route-card" aria-label="Trayectoria de misión espacial">
        <div className="mission-route-head">
          <div className="mission-route-title">

            <div>
              <strong>Misión · {astronaut.shortName}</strong>
              <span>{LOCATION_LABELS[astronaut.environment] ?? astronaut.environment} · {astronaut.gravityLabel}</span>
            </div>
          </div>
          <span className="mission-dest-pill">
            RUMBO · {(LOCATION_LABELS[astronaut.destination] ?? astronaut.destination).toUpperCase()}
          </span>
        </div>

        <svg viewBox="0 0 340 88" className="mission-route-svg" aria-hidden="true">
          <defs>
            <clipPath id="mission-ship-clip">
              <circle cx="170" cy="25" r="14.5" />
            </clipPath>
          </defs>

          {MISSION_STARS.map((st, idx) => (
            <circle key={idx} cx={st.x} cy={st.y} r={st.r} fill="#e0f2fe" opacity={st.o} />
          ))}

          {/* Órbita punteada completa */}
          <path
            d="M 46 44 Q 170 4 294 44"
            fill="none"
            stroke="rgba(148, 163, 184, 0.34)"
            strokeWidth="2.2"
            strokeDasharray="4 4"
          />
          {/* Tramo recorrido */}
          <path
            d="M 46 44 Q 108 18 170 25"
            fill="none"
            stroke="#58c7f3"
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Salida: Tierra (más grande y animada) */}
          <g className="mission-origin-orbit">
            <circle
              cx="46"
              cy="44"
              r="22.5"
              fill="none"
              stroke="rgba(56, 189, 248, 0.5)"
              strokeWidth="1.2"
              strokeDasharray="3.5 3.5"
            />
            <circle cx="46" cy="21.5" r="2.2" fill="#38bdf8" />
          </g>
          <circle cx="46" cy="44" r="16.5" fill="#0284c7" stroke="rgba(125, 211, 252, 0.4)" strokeWidth="1.2" />
          <path
            d="M38.5 36.5c3.5 1.2 4.8 4.8 2.8 7.6-1.4 1.8-3.4 3.1-3.4 5.7 3.4 2.2 7.8 3.1 11.6 2.1-1-2.9 1.4-5.8 3.4-7-1.7-4.8-6.5-8.4-14.4-8.4z"
            fill="#93DEFF"
          />
          <text x="46" y="81" textAnchor="middle" className="mission-endpoint-label">
            SALIDA · {(LOCATION_LABELS[astronaut.origin] ?? astronaut.origin).toUpperCase()}
          </text>

          {/* Nave espacial en ruta (Naveee (1).svg) con flotación suave */}
          <g className="mission-ship-marker">
            <circle cx="170" cy="25" r="18" fill="rgba(115, 203, 244, 0.22)" />
            <circle cx="170" cy="25" r="15" fill="#060b19" stroke="#73cbf4" strokeWidth="1.8" />
            <image
              href={shipSprite}
              x="158.5"
              y="17.5"
              width="23"
              height="15"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* Destino: Luna (más grande con halo) */}
          <circle cx="294" cy="44" r="22" fill="rgba(56, 189, 248, 0.16)" className="mission-dest-glow" />
          <circle cx="294" cy="44" r="15.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.3" />
          <circle cx="289" cy="39" r="3" fill="#64748b" />
          <circle cx="299" cy="49" r="2.3" fill="#64748b" />
          <circle cx="298" cy="38" r="1.6" fill="#64748b" />
          <circle cx="288" cy="49" r="1.4" fill="#94a3b8" />
          <text x="294" y="81" textAnchor="middle" className="mission-endpoint-label">
            DESTINO · {(LOCATION_LABELS[astronaut.destination] ?? astronaut.destination).toUpperCase()}
          </text>
        </svg>
      </div>

      {/* Tarjeta blanca de Pulso ECG */}
      <div className="pulse-hero-card">
        <div className="pulse-hero-top">
          <div className="pulse-hero-left">
            <span
              className={`pulse-heart-icon ${isAvailable ? 'beating' : ''}`}
              style={{
                color: isAvailable ? '#ef4444' : '#cbd5e1',
                animationDuration: `${beatDurationSec.toFixed(3)}s`,
              }}
            >
              <HeartIcon size={20} strokeWidth={2.3} />
            </span>

            {isAvailable && bpm !== null ? (
              <div className="pulse-bpm-group">
                <strong className="pulse-bpm-number">{bpm}</strong>
                <span className="pulse-bpm-unit">Lpm</span>
              </div>
            ) : (
              <span className="pulse-unavailable-text">Pulso no disponible</span>
            )}
          </div>

          <div className="pulse-hero-right">
            <span className="pulse-live-label" style={{ color: statusMeta.color }}>
              <ActivityIcon size={12} />
              <span>{statusMeta.label}</span>
            </span>
            <span className="pulse-time-label">
              {vitals.lastMeasuredAt ? `Último: ${vitals.lastMeasuredAt}` : 'Sin lecturas'}
            </span>
          </div>
        </div>

        <div className="pulse-ecg-canvas" aria-label="Trazado ECG continuo">
          <div className="pulse-ecg-grid" />
          {isAvailable ? (
            <svg
              className="pulse-ecg-svg animated"
              style={{ animationDuration: `${beatDurationSec.toFixed(3)}s` }}
              viewBox={`0 0 ${ECG_VIEWBOX_WIDTH} ${ECG_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={bpm ? `ECG a ${bpm} latidos por minuto` : 'Sin señal ECG'}
            >
              <line
                x1="0"
                y1={ECG_HEIGHT / 2}
                x2={ECG_VIEWBOX_WIDTH}
                y2={ECG_HEIGHT / 2}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <path
                className="pulse-ecg-track"
                d={ECG_CONTINUOUS_PATH}
                fill="none"
                stroke={statusMeta.stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              className="pulse-ecg-svg"
              viewBox={`0 0 384 ${ECG_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Sin señal ECG"
            >
              <line
                x1="0"
                y1={ECG_HEIGHT / 2}
                x2="384"
                y2={ECG_HEIGHT / 2}
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeOpacity="0.65"
              />
            </svg>
          )}

          {isAvailable && (
            <div
              className="pulse-sweep-beam active"
              style={{ animationDuration: `${beatDurationSec.toFixed(3)}s` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
