import React, { useEffect, useState } from 'react';
import brandLogo from '../assets/Recurso 6.svg';
import type {
  AstronautProfile,
  ConnectionEndpointStatus,
} from '../types/dashboard';
import {
  AlertTriangleIcon,
  CheckIcon,
  MoonIcon,
  OrbitIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SunIcon,
} from './Icons';

interface AstronautProfileBarProps {
  astronauts: AstronautProfile[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
  connectionStatus: ConnectionEndpointStatus;
  globalRiskLevel: 'normal' | 'warning' | 'critical';
  activeLesionsCount: number;
  isSyncing: boolean;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onManualRefresh: () => void;
}

const RISK_META: Record<
  AstronautProfileBarProps['globalRiskLevel'],
  { label: string; renderIcon: () => React.ReactNode }
> = {
  normal: {
    label: 'Nominal',
    renderIcon: () => <CheckIcon size={11} strokeWidth={2.5} />,
  },
  warning: {
    label: 'Vigilar',
    renderIcon: () => <AlertTriangleIcon size={11} strokeWidth={2.4} />,
  },
  critical: {
    label: 'Crítico',
    renderIcon: () => <ShieldAlertIcon size={11} strokeWidth={2.4} />,
  },
};

export const AstronautProfileBar: React.FC<AstronautProfileBarProps> = ({
  astronauts,
  selectedAstronautId,
  onSelectAstronaut,
  connectionStatus,
  globalRiskLevel,
  activeLesionsCount,
  isSyncing,
  themeMode,
  onToggleTheme,
  onManualRefresh,
}) => {
  const [clock, setClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeFormatted = clock.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const lastSyncFormatted = connectionStatus.lastSyncIso
    ? new Date(connectionStatus.lastSyncIso).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    : '--:--';

  const riskMeta = RISK_META[globalRiskLevel];

  return (
    <header className="topbar-shell">
      <div className="topbar-brand">
        <div className="brand-pulse-box">
          <img src={brandLogo} alt="Logo TraumaTeam" className="brand-logo-img" />
        </div>
        <div className="brand-text-group">
          <div className="brand-title-row">
            <h1 className="brand-wordmark">
              <span className="brand-heavy">Trauma</span>Team
            </h1>
            <span className={`global-status-chip status-${globalRiskLevel}`}>
              {riskMeta.renderIcon()}
              <span>
                {riskMeta.label}
                {activeLesionsCount > 0
                  ? ` · ${activeLesionsCount} zona${activeLesionsCount === 1 ? '' : 's'}`
                  : ''}
              </span>
            </span>
          </div>
          <span className="brand-subtitle">GROUND CONTROL · TELEMETRÍA BIOMÉDICA</span>
        </div>
      </div>

      <div className="topbar-profiles" aria-label="Perfil de astronauta activo">
        {astronauts.map((astro) => {
          const isSelected = astro.id === selectedAstronautId;
          const envBadge =
            astro.environment === 'nave' ? '0g · Órbita' : astro.gravityLabel;
          return (
            <button
              key={astro.id}
              type="button"
              className={`astronaut-card-btn ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectAstronaut(astro.id)}
            >
              <div className="astro-avatar">
                {astro.shortName
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="astro-info">
                <div className="astro-name-row">
                  <strong>{astro.name}</strong>
                  <span className="astro-code">{astro.code}</span>
                </div>
                <span className="astro-role">{astro.role}</span>
              </div>
              <span className="astro-env-pill">
                <OrbitIcon size={11} />
                <span>{envBadge}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="topbar-right">
        <div className="sync-and-clock">
          <div className="sync-pill-wrap">
            <span className={`sync-dot ${connectionStatus.healthOk ? 'online' : 'offline'}`} />
            <span className="sync-text">
              {connectionStatus.healthOk ? 'En línea' : 'Sin enlace'} · {lastSyncFormatted}
            </span>
          </div>
          <div className="mission-clock">{timeFormatted}</div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={`icon-action-btn ${isSyncing ? 'spinning' : ''}`}
            onClick={onManualRefresh}
            title="Sincronizar ahora"
            aria-label="Sincronizar telemetría"
          >
            <RefreshCwIcon size={16} />
          </button>

          <button
            type="button"
            className="icon-action-btn"
            onClick={onToggleTheme}
            title={themeMode === 'light' ? 'Modo Nocturno' : 'Modo Claro'}
            aria-label="Cambiar tema visual"
          >
            {themeMode === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
};
