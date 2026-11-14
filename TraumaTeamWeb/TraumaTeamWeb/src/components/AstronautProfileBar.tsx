import React, { useEffect, useId, useRef, useState } from 'react';
import brandLogo from '../assets/Recurso 6.svg';
import type {
  AstronautProfile,
  ConnectionEndpointStatus,
} from '../types/dashboard';
import {
  CheckIcon,
  ChevronDownIcon,
  OrbitIcon,
  UserPlusIcon,
} from './Icons';

interface AstronautProfileBarProps {
  astronauts: AstronautProfile[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
  connectionStatus: ConnectionEndpointStatus;
}

function getInitials(shortName: string): string {
  return shortName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const AstronautProfileBar: React.FC<AstronautProfileBarProps> = ({
  astronauts,
  selectedAstronautId,
  onSelectAstronaut,
  connectionStatus,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownWrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const activeAstronaut =
    astronauts.find((a) => a.id === selectedAstronautId) ?? astronauts[0];
  const envBadge =
    activeAstronaut?.environment === 'nave'
      ? '0g · Órbita'
      : activeAstronaut?.gravityLabel ?? '';

  useEffect(() => {
    if (!dropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownWrapRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleWindowBlur = () => setDropdownOpen(false);

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [dropdownOpen]);

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
          </div>
          <span className="brand-subtitle">GROUND CONTROL · TELEMETRÍA BIOMÉDICA</span>
        </div>
      </div>

      <div
        ref={dropdownWrapRef}
        className="topbar-profiles astro-dropdown-wrap"
        aria-label="Perfil de astronauta activo"
      >
        {activeAstronaut && (
          <button
            ref={triggerRef}
            type="button"
            className={`astronaut-card-btn ${dropdownOpen ? 'is-open' : ''}`}
            aria-expanded={dropdownOpen}
            aria-controls={panelId}
            onClick={() => setDropdownOpen((open) => !open)}
          >
            <div className="astro-avatar">{getInitials(activeAstronaut.shortName)}</div>
            <div className="astro-info">
              <strong className="astro-compact-name">{activeAstronaut.name}</strong>
              <span className="astro-compact-meta">
                {activeAstronaut.code} · {envBadge}
              </span>
            </div>
            <ChevronDownIcon
              size={14}
              className={`astro-trigger-chevron ${dropdownOpen ? 'rotated' : ''}`}
            />
          </button>
        )}

        {dropdownOpen && (
          <div
            id={panelId}
            className="astro-dropdown-panel"
            aria-label="Perfiles de tripulación"
          >
            <div className="astro-dropdown-header">
              <span>TRIPULACIÓN ACTIVA</span>
            </div>

            <div className="astro-dropdown-list">
              {astronauts.map((astro) => {
                const isSelected = astro.id === selectedAstronautId;
                const astroEnv =
                  astro.environment === 'nave' ? '0g · Órbita' : astro.gravityLabel;
                return (
                  <button
                    key={astro.id}
                    type="button"
                    className={`astro-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectAstronaut(astro.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <div className="astro-avatar sm">{getInitials(astro.shortName)}</div>
                    <div className="astro-dropdown-copy">
                      <strong>{astro.name}</strong>
                      <span>
                        <OrbitIcon size={10} /> {astro.code} · {astroEnv}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="astro-dropdown-check" aria-hidden="true">
                        <CheckIcon size={13} strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="astro-dropdown-divider" />

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="astro-dropdown-add-btn"
              title="Opción no disponible por el momento"
            >
              <span className="astro-add-icon-box">
                <UserPlusIcon size={14} />
              </span>
              <span className="astro-add-label">Agregar otro perfil</span>
              <span className="astro-add-tag">Próximamente</span>
            </button>
          </div>
        )}
      </div>

      <div className="topbar-right">
        <div className="sync-pill-wrap is-standalone" role="status" aria-live="polite">
          <span className={`sync-dot ${connectionStatus.healthOk ? 'online' : 'offline'}`} />
          <span className="sync-text">
            {connectionStatus.healthOk ? 'En línea' : 'Sin enlace'}
          </span>
        </div>
      </div>
    </header>
  );
};
