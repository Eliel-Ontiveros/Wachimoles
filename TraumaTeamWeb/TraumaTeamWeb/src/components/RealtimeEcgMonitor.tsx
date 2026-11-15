import React, { useMemo } from 'react';
import earthBackground from '../../../../TraumaTeamMovil/assets/images/fondos/banners/EarthBanner.svg';
import shipBackground from '../../../../TraumaTeamMovil/assets/images/fondos/banners/ShipBanner.svg';
import stationBackground from '../../../../TraumaTeamMovil/assets/images/fondos/banners/StationBanner.svg';
import moonBackground from '../../../../TraumaTeamMovil/assets/images/fondos/banners/MoonBanner.svg';
import marsBackground from '../../../../TraumaTeamMovil/assets/images/fondos/banners/MarsBanner.svg';
import type { AstronautProfile, VitalSignsData } from '../types/dashboard';
import { HeartRateIcon } from './Icons';

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

const LOCATION_LABELS: Record<string, string> = {
  tierra: 'Earth',
  earth: 'Earth',
  luna: 'Moon',
  moon: 'Moon',
  marte: 'Mars',
  mars: 'Mars',
  nave: 'In Spaceship (Orbit)',
  spaceship: 'In Spaceship (Orbit)',
  estacion: 'Space Station (ISS)',
  station: 'Space Station (ISS)',
};

// Artwork follows the astronaut's current location.
const LOCATION_ENVIRONMENTS = {
  tierra: { background: earthBackground, gravity: '1.0g Earth Gravity' },
  nave: { background: shipBackground, gravity: '0g Microgravity' },
  estacion: { background: stationBackground, gravity: '0g Microgravity' },
  luna: { background: moonBackground, gravity: '0.16g Lunar Gravity' },
  marte: { background: marsBackground, gravity: '0.38g Martian Gravity' },
} satisfies Record<AstronautProfile['environment'], { background: string; gravity: string }>;

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
  const locationEnvironment = LOCATION_ENVIRONMENTS[astronaut.environment] ?? LOCATION_ENVIRONMENTS.tierra;
  const bpm = vitals.heartRate !== null && vitals.heartRate > 0 ? vitals.heartRate : null;
  const isAvailable = vitals.isAvailable && bpm !== null;

  const statusMeta = useMemo(() => {
    if (!isAvailable || bpm === null) {
      return { label: 'No signal', color: '#94a3b8', stroke: '#94a3b8' };
    }
    if (bpm >= 115 || bpm < 48) {
      return { label: 'Critical pulse', color: '#ef4444', stroke: '#ef4444' };
    }
    if (bpm >= 100) {
      return { label: 'Elevated pulse', color: '#f59e0b', stroke: '#f59e0b' };
    }
    if (bpm < 55) {
      return { label: 'Low pulse', color: '#f59e0b', stroke: '#f59e0b' };
    }
    return { label: 'Live pulse', color: '#0284c7', stroke: '#0284c7' };
  }, [bpm, isAvailable]);

  const beatDurationSec = bpm ? Math.max(0.32, Math.min(1.8, 60 / bpm)) : 3.6;

  return (
    <div className="environment-and-pulse-stack">
      <div className="environment-card" data-environment={astronaut.environment} aria-label="Current astronaut location">
        <img className="environment-card-background" src={locationEnvironment.background} alt="" aria-hidden="true" />
        <strong className="environment-card-name">{LOCATION_LABELS[astronaut.environment] ?? astronaut.environment}</strong>
        <span className="environment-card-gravity">{astronaut.gravityLabel.trim() || locationEnvironment.gravity}</span>
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
              <HeartRateIcon size={20} />
            </span>

            {isAvailable && bpm !== null ? (
              <div className="pulse-bpm-group">
                <strong className="pulse-bpm-number">{bpm}</strong>
                <span className="pulse-bpm-unit">BPM</span>
              </div>
            ) : (
              <span className="pulse-unavailable-text">Pulse unavailable</span>
            )}
          </div>

          <div className="pulse-hero-right">
            <span className="pulse-live-label" style={{ color: statusMeta.color }}>
              <HeartRateIcon size={12} />
              <span>{statusMeta.label}</span>
            </span>
            <span className="pulse-time-label">
              {vitals.lastMeasuredAt ? `Last: ${vitals.lastMeasuredAt}` : 'No readings'}
            </span>
          </div>
        </div>

        <div className="pulse-ecg-canvas" aria-label="Continuous ECG trace">
          <div className="pulse-ecg-grid" />
          {isAvailable ? (
            <svg
              className="pulse-ecg-svg animated"
              style={{ animationDuration: `${beatDurationSec.toFixed(3)}s` }}
              viewBox={`0 0 ${ECG_VIEWBOX_WIDTH} ${ECG_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={bpm ? `ECG at ${bpm} beats per minute` : 'No ECG signal'}
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
              aria-label="No ECG signal"
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
